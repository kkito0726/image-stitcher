# backend ログ出力の設計

- 作成日: 2026-09-27
- 対象: `backend` (FastAPI + gunicorn / UvicornWorker)
- 参考: svg_converter リポジトリの `docs/logging-design.md` (Flask 版)。方針はそれに揃え、FastAPI の構造と本リポジトリの判断に合わせて変えた点を §7 にまとめる

## 1. 目的と方針

ログで答えたい問い:

| 目的 | 知りたいこと |
|---|---|
| 障害調査 | どのリクエストが、どの入力で、なぜ失敗したか |
| 運用監視 | リクエスト数・エラー率・処理時間 (特に Raspberry Pi 上の合成時間) |

方針:

- **構造化ログ (JSON 1 行 1 イベント)** を stdout に出し、保存は Docker (json-file、10MB × 3) に任せる
- `event` は固定のドット区切り名にし、値はフィールドに分ける
- 1 リクエストのログは `request_id` で束ねる
- 利用者のデータ (画像の中身・ファイル名) と秘密情報は出さない
- **IP アドレスは記録しない。** User-Agent だけを記録する (2026-09-27 に決定)

## 2. 実装の構成

| ファイル | 役割 |
|---|---|
| `src/infra/logging_config.py` | `LogSettings` (環境変数の検証)、`build_logging_dict()` (gunicorn と共用)、`configure_logging()` |
| `src/presentation/request_logging.py` | request_id の検証、ヘッダの伏せ字、アップロードの要約 (純粋関数) と `RequestLoggingMiddleware` |
| `src/presentation/error_reason.py` | 理由コード `ErrorReason` (`StrEnum`) |
| `src/usecase/stitch_images.py` / `get_stitch_result.py` | 処理時間の計測と `stitch.completed` / `download.completed` |
| `src/main.py` | 起動時に `configure_logging()`、ウォームアップの `warmup.completed` / `warmup.failed` |
| `gunicorn.conf.py` | `logconfig_dict` で gunicorn のログも同じ形式にする。ワーカー数等もここに移した |

structlog と標準 `logging` は `ProcessorFormatter` で統合しているため、gunicorn・uvicorn・ライブラリのログも同じ JSON 形式で出る。

## 3. ログの形式

### 3.1 共通フィールド

| キー | 例 | 備考 |
|---|---|---|
| `timestamp` | `2026-09-27T01:23:45.678Z` | UTC、ISO 8601 |
| `level` | `info` | |
| `event` | `request.completed` | 集計のキー |
| `logger` | `src.usecase.stitch_images` | |
| `request_id` | `9f1c2a...` | リクエスト処理中のみ (§4) |
| `cf_ray` | `8c7a...-NRT` | `CF-Ray` ヘッダがある場合のみ |

### 3.2 イベント一覧

| event | level | 主なフィールド | 出す場所 |
|---|---|---|---|
| `request.completed` | 2xx/3xx: info、4xx: warning、5xx: error | `method`, `path`, `status`, `duration_ms`, `content_length`, `user_agent`, (4xx/5xx) `reason`, `request`, (応答の送信中に失敗) `aborted` | ミドルウェア。`/health` は除外 |
| `request.failed` | error | `exception` (スタックトレース) | ミドルウェア (想定外の例外) |
| `stitch.completed` | info | `mode`, `image_count`, `total_pixels`, `decode_ms`, `stitch_ms`, `stitched`, (成功時) `output_width`, `output_height`, `preview_ms`, `preview_bytes`, (失敗時) `failure` | `StitchImagesUseCase` |
| `download.completed` | info | `format`, `bytes`, `encode_ms` | `GetStitchResultUseCase` |
| `warmup.completed` / `warmup.failed` | info / warning | `duration_ms`, (失敗時) `failure` | `main.py` |

- `path` は **ルートのテンプレート** (`/stitch/{result_id}/download`) を出す。生のパスには結果 ID (ダウンロードの鍵) が含まれるため。ルートに当たらない場合は、結果 ID の部分を伏せたうえで 128 文字で切り詰める
- エラー件数の集計は `event == "request.failed"` で行う (`request.completed` の 5xx と二重に数えない)
- 合成できずに 422 になった場合も `stitch.completed` (`stitched: false`) に処理時間が残る

### 3.3 `reason` コード

利用者に返すメッセージは変えず、集計用のコードを別に持つ。

| reason | 状況 | status |
|---|---|---|
| `invalid_params` | 必須項目の欠落、`format` が不正 | 400 |
| `too_many_images` | 枚数上限の超過 | 400 |
| `body_too_large` | 合計バイト数の超過 | 400 |
| `invalid_image` | 画像をデコードできない | 400 |
| `image_too_large` | デコード後の画素数が上限を超過 | 400 |
| `need_more_images` / `homography_estimation_failed` / `camera_params_adjust_failed` | 合成できない (`StitchFailureReason` と同じ値) | 422 |
| `result_not_found` | 結果 ID が存在しないか期限切れ | 404 |
| `internal_error` | 想定外の例外 | 500 |

コードを追加・変更するときは `ErrorReason` とこの表を更新する。

### 3.4 出力例

```json
{"stitched": true, "output_width": 3501, "output_height": 3238, "preview_ms": 41, "preview_bytes": 429757, "mode": "Scans", "image_count": 6, "total_pixels": 26873856, "decode_ms": 180, "stitch_ms": 1320, "event": "stitch.completed", "request_id": "9f1c2a...", "level": "info", "logger": "src.usecase.stitch_images", "timestamp": "2026-09-27T01:23:45.678Z"}
{"method": "POST", "path": "/stitch", "status": 200, "duration_ms": 1580, "content_length": "16700000", "user_agent": "Mozilla/5.0 (Macintosh; ...)", "event": "request.completed", "request_id": "9f1c2a...", "level": "info", "logger": "request_logging", "timestamp": "..."}
```

入力エラー時は `request` が付く:

```json
{"method": "POST", "path": "/stitch", "status": 400, "reason": "too_many_images", "request": {"headers": {"content-type": "multipart/form-data; boundary=...", "user-agent": "Mozilla/5.0 ...", "cookie": "[REDACTED]", "x-real-ip": "[REDACTED]"}, "form": {"mode": "Scans"}, "files": [{"field": "images", "content_type": "image/jpeg", "size": 2782365, "ext": ".jpg", "filename_len": 12}]}, "event": "request.completed", "level": "warning", "...": "..."}
```

## 4. request_id

1. nginx が `proxy_set_header X-Request-ID $request_id;` で付け、自身のアクセスログにも `rid=$request_id` として出す
2. ミドルウェアが `X-Request-ID` を受け取る。全体が `[A-Za-z0-9-]{1,64}` に一致する場合だけ採用し、合わなければ `uuid4().hex` を生成する (ログ偽装や巨大な値の対策)
3. `structlog.contextvars` に束ねる。スレッドプールで動く usecase のログにも自動で付く
4. レスポンスヘッダ `X-Request-ID` で返す

## 5. リクエスト内容の記録

`request.completed` の `request` フィールドは、4xx / 5xx のとき (と `LOG_LEVEL=DEBUG` のとき) だけ付ける。

| 項目 | 出し方 |
|---|---|
| ヘッダ | 名前はすべて出す。値は許可リストのものだけ出し (512 文字で切り詰め)、それ以外は `[REDACTED]`。`Referer` はクエリとフラグメントを落とす |
| フォーム項目 | `mode` を 1KB で切り詰めて出す |
| アップロードファイル | `field`, `content_type`, `size`, `ext`, `filename_len` のみ。**ファイル名そのものと中身は出さない** (DEBUG でも出さない) |

値を出すヘッダの許可リスト: `Content-Type`, `Content-Length`, `User-Agent`, `Accept`, `Accept-Language`, `Origin`, `Referer`, `X-Request-ID`, `CF-Ray`, `CF-IPCountry`。

IP を含むヘッダ (`X-Real-IP`, `X-Forwarded-For`, `CF-Connecting-IP`) や `Cookie`, `Authorization` は許可リスト外なので伏せられる。ルートに当たらないパス (末尾スラッシュ付きなど) も、結果 ID の部分は `{result_id}` に置き換える。CORS のプリフライトは CORS ミドルウェアが先に応答するため記録しない。必須項目の欠落 (`invalid_params`) のようにルーターまで届かないリクエストは、`headers` だけになる。

## 6. 設定

| 変数 | 既定値 | 用途 |
|---|---|---|
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `LOG_FORMAT` | `json` | `json` または `console` (開発用のカラー表示。`docker-compose.dev.yml` で使う) |

不正な値の場合は起動時に `ValueError` で落とす。

gunicorn と uvicorn のアクセスログ (接続元 IP を含む) は `WARNING` に絞って止め、`request.completed` で代替する。

## 7. 参考設計 (svg_converter) との違い

| 項目 | 参考設計 | 本リポジトリ | 理由 |
|---|---|---|---|
| `client_ip` | `X-Real-IP` から記録する | **記録しない** | 利用者の IP を持たない方針にした。不正利用の調査は Cloudflare のダッシュボードで行う |
| フック | Flask の `before_request` / `after_request` | pure ASGI ミドルウェア | 同期エンドポイントはスレッドで動き、Flask の `g` に相当するものがない。ミドルウェアが作ったオブジェクトにルーターが `reason` を書き込む |
| 500 の処理 | `except Exception` で `convert.failed` | ミドルウェアで捕捉して `request.failed` を出し、詳細を含まない 500 を返す | Starlette では想定外の例外がミドルウェアの外側で処理され、`X-Request-ID` を付けられないため |
| `path` | 生のパス | ルートのテンプレート | ダウンロードの URL に結果 ID が含まれるため |

## 8. 既知の制約

- **nginx のアクセスログ**: `frontend/nginx.conf` の `log_format` は、今も `$remote_addr` と `$http_x_forwarded_for` (Cloudflare が付けた利用者の IP) を記録している。backend だけでなく全体で IP を持たないようにするなら、この 2 つも外す
- **gunicorn の Control server エラー**: 起動時に `Control server error: [Errno 13] Permission denied: '/nonexistent'` が 1 行出る。実行ユーザーにホームディレクトリがないためで、リクエスト処理には影響しない
- **ログの保持**: json-file ドライバのログはコンテナの作り直しで消え、容量ベース (10MB × 3) で上書きされる。長期の保持が必要になったら別途検討する
