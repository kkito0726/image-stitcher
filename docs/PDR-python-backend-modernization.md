# PDR: Python バックエンド近代化（multipart 化・クリーンアーキテクチャ導入・負債解消）

- ステータス: Draft
- 作成日: 2026-07-05
- 対象: `backend/`（Flask + opencv-python）の Python のままでの全面刷新
- 関連文書: [PDR-cpp-backend-migration.md](./PDR-cpp-backend-migration.md)（C++ 移行案。本 PDR の採用により**保留**）

---

## 1. 背景と目的

### 経緯

当初は速度改善を目的に C++ 移行を計画した（C++ 版 PDR 参照）。しかし事前実測（C++ 版 PDR §9.1）により以下が判明した:

- 処理時間の 85〜95% は `cv::Stitcher` / `imencode` であり、**Python 版でもすでに C++ で実行されている**。C++ 移行単体のレイテンシ改善は 1.1〜1.2 倍にとどまる
- 実測で見つかった主要な速度改善レバー（初回リクエストの約 6 倍遅延、multipart 化、本番用 WSGI サーバー、隣接ペア限定マッチング）は**いずれも Python のまま実現できる**

したがって、C++ 移行で得たかった実利（性能・契約刷新・保守性）を Python のまま数日規模の工数で回収する本方針を採用する。C++ 移行は保留とし、再開条件を §11 に定める。

### 目的

1. **性能**: 初回遅延の解消、multipart 化による転送 25% 削減、本番用サーバーによるスループット改善
2. **負債解消**: 潜在バグ・バリデーション不在・テストゼロ・依存の古さを一掃する
3. **保守性**: クリーンアーキテクチャ（domain 層に Protocol インターフェース、infra 層に OpenCV 実装)を導入する
4. **運用コスト**: 現行の 0 円運用（ghcr.io 配布 + ユーザーのローカル実行)を維持。将来の Cloud Run 等への 0 円デプロイも可能な構成にする

## 2. 解消する負債の棚卸し

| # | 負債 | 現状 | 対処 |
|---|------|------|------|
| 1 | API 契約が Base64 in JSON | 転送 +33%、エンコード往復 4 回 | multipart/form-data + PNG バイナリ（§3） |
| 2 | 初回リクエストが約 6 倍遅い | 起動後最初の stitch に内部初期化コスト（実測 4.4s vs 0.6s） | 起動時にダミー画像でウォームアップ |
| 3 | Flask 開発サーバーで本番稼働 | シングルプロセス、`app.debug = True` | gunicorn + uvicorn worker |
| 4 | `np.array(read_img)` の潜在バグ | サイズの異なる画像で失敗 | `list[np.ndarray]` のまま `Stitcher.stitch` に渡す |
| 5 | エラーハンドリング不在 | status 0/1 以外で 500、バリデーション・上限なし | §5 エラー設計 + 上限 100MB / 30 枚 |
| 6 | テストゼロ | ユニット・統合とも皆無 | pytest で TDD、カバレッジ 80%+ |
| 7 | 依存の古さ | Flask 2.2.2 (2022)、opencv-python 4.6、`numpy<2` ピン | 最新安定版へ更新、`opencv-python-headless` 化 |
| 8 | イメージサイズ | ≈1GB（GUI 依存込みの opencv-python） | headless + slim 構成で 400MB 程度を目標 |
| 9 | レイヤ分離なし | HTTP・コーデック・スティッチが 2 ファイルに密結合 | クリーンアーキテクチャ（§4） |

## 3. API 契約（新契約）

C++ 版 PDR §3 で設計した契約をそのまま採用する（契約は実装言語に依存しない）。

### `GET /health`

```json
200 {"status": "healthy"}
```

ウォームアップ完了後に healthy を返す（§6.2）。

### `POST /stitch`

Request:

```
Content-Type: multipart/form-data

  mode:   "Scans" | "Panorama"   （テキストフィールド）
  images: File × N               （画像バイナリ。PNG / JPEG）

上限: images は最大 30 枚、リクエストボディ全体で最大 100MB（超過は 400）
```

Response:

| ケース | ステータス | Content-Type | ボディ |
|--------|-----------|--------------|--------|
| 合成成功 | 200 | `image/png` | 合成画像の PNG バイナリ |
| 合成失敗（特徴点不足など） | 422 | `application/json` | `{"isStitched": 1, "reason": "need_more_images" 等}` |
| リクエスト不正 | 400 | `application/json` | `{"error": "<内容>"}` |
| 予期しない内部エラー | 500 | `application/json` | `{"error": "internal server error"}` |

- フロントは HTTP ステータスで成功 / 失敗を判定
- CORS: `http://localhost:3000`, `http://image-stitcher-frontend` を許可（現行と同一）
- フロントエンド側の変更（`FormData` 送信、`responseType: "blob"` 受信、`URL.createObjectURL` プレビュー）も C++ 版 PDR §3 と同一

## 4. アーキテクチャ設計

### 4.1 レイヤ構成

C++ 版 PDR §5 の設計を Python に翻訳する。インターフェースは `typing.Protocol`、エンティティは `@dataclass(frozen=True)`（イミュータブル）で表現する。

```
backend/
├── pyproject.toml              # 依存・ツール設定（ruff, mypy, pytest, coverage）
├── Dockerfile
├── src/
│   ├── main.py                 # Composition Root（DI 組み立て、ウォームアップ、起動）
│   ├── domain/
│   │   ├── models.py           # StitchMode(Enum), StitchResult(frozen dataclass)
│   │   └── ports.py            # ImageStitcher(Protocol), ImageCodec(Protocol)
│   ├── usecase/
│   │   └── stitch_images.py    # StitchImagesUseCase — domain の Protocol にのみ依存
│   ├── infra/
│   │   └── opencv/
│   │       ├── cv_stitcher.py  # ImageStitcher 実装（cv2.Stitcher）
│   │       └── cv_codec.py     # ImageCodec 実装（imdecode / imencode）
│   └── presentation/
│       ├── app.py              # FastAPI アプリ生成・CORS・例外ハンドラ
│       ├── schemas.py          # Pydantic モデル（エラーレスポンス等）
│       └── routers/
│           ├── health.py
│           └── stitch.py       # multipart 取り出し・バリデーション・usecase 呼び出し
└── tests/
    ├── unit/                   # domain / usecase（ports をモック） / infra / presentation
    ├── integration/            # TestClient で multipart → PNG の往復
    └── fixtures/               # テスト用重なり画像（小サイズ）
```

- domain / usecase は `cv2` `numpy` `fastapi` を import しない（レイヤ違反は import-linter で CI 検査）
- 画像データは domain 上では `bytes` / 抽象型として扱い、`np.ndarray` への依存は infra に閉じる

### 4.2 技術選定

| 項目 | 選定 | 理由 |
|------|------|------|
| Web フレームワーク | **FastAPI**（推奨。§12 未決 #1） | multipart・バリデーション（Pydantic）・OpenAPI ドキュメントが標準。presentation 層はどうせ書き直すため移行差分は小さい。代替: Flask 3.x + gunicorn（最小差分だが検証・ドキュメントを自前実装） |
| ASGI サーバー | gunicorn + uvicorn worker | 本番実績。ワーカー数で同時合成の並列度を制御 |
| OpenCV | `opencv-python-headless` 最新 4.x | GUI 依存（libGL 等）を排除しイメージ削減。API は現行と同一 |
| 検証 | Pydantic v2 | 入力バリデーションの宣言的記述 |
| テスト | pytest + pytest-cov + httpx(TestClient) | カバレッジ 80%+ |
| 品質 | ruff + mypy(strict) + import-linter | 型・レイヤ依存の機械的検査 |

## 5. エラーハンドリング方針

C++ 版 PDR §5.5 と同一（422 集約 + `reason`、400 バリデーション、500 は詳細をログのみ）。実装上は:

- usecase は `StitchResult`（成功画像 or 失敗理由）を返し、例外を制御フローに使わない
- presentation の例外ハンドラで未捕捉例外を 500 JSON に変換（スタックトレースはログのみ）
- 現行の「status 0/1 以外で 500」バグは、status 0 以外を 422 に集約して解消

## 6. 性能改善の実装項目

事前実測（C++ 版 PDR §9.1）に基づく。

1. **起動時ウォームアップ**: `main.py` で同梱ダミー画像 2 枚を一度 stitch してからサーバーを ready にする。初回リクエストの約 6 倍遅延（実測 4.4s → 0.6s 相当）を解消
2. **multipart 化**: 転送 25% 削減 + Base64 エンコード往復の排除（§3）
3. **gunicorn ワーカー**: 同時利用時のスループットをワーカー数分に改善（現行は実質直列）
4. **（任意・Phase 7）隣接ペア限定マッチング**: `cv2.detail` API で全ペア総当たり O(N²) を隣接ペアに限定。実測で 12 枚時に stitch 時間が 5 枚時の 3.6 倍のため、20〜30 枚では数倍の効果見込み

ヘルスチェックはウォームアップ完了後に healthy を返すことで、compose の `depends_on: service_healthy` が「即応答できる状態」を保証する。

## 7. Docker・デプロイ

- multi-stage: builder（pip install）→ runtime（python:3.12-slim + site-packages + src、非 root uid 1001）
- 目標イメージサイズ: **400MB 程度**（現行 ≈1GB。headless 化 + slim 化による）
- compose のメモリ制限を 1G → **2G** に引き上げ（上限 100MB 入力のデコード後ピークに対応。C++ 版 PDR §9.1 の知見）
- 運用コスト: 現行の ghcr.io 配布 + ローカル実行（0 円）を維持。将来クラウド化する場合も Cloud Run（ゼロスケール、無料枠内）で 0 円運用が成立する見込み。ゼロスケール時のコールドスタートにウォームアップ時間が乗る点は §12 未決 #2

## 8. テスト計画

TDD（RED → GREEN → REFACTOR）で実装。カバレッジ 80%+ を CI で強制。

| 対象 | 種別 | 内容 |
|------|------|------|
| domain | Unit | `StitchMode` 変換（"Scans" → Scans、その他 → Panorama）、`StitchResult` |
| usecase | Unit | ports をモックし、成功 / 合成失敗 / デコード失敗の各パス |
| infra | Unit | codec のラウンドトリップ、壊れたバイト列、fixtures での実 stitch（成功 / 特徴点不足） |
| presentation | Unit | multipart バリデーション（欠落・0 枚・31 枚・100MB 超過）、エラー JSON |
| 統合 | Integration | TestClient で multipart → 200 PNG / 422 / 400 の往復。ウォームアップ後の /health |
| E2E | Playwright | 改修後フロントで選択 → 合成 → 表示 → ダウンロードの一連フロー |

## 9. 移行計画

| Phase | 内容 | 完了条件 |
|-------|------|----------|
| 1. 骨格構築 | pyproject + レイヤ構造 + FastAPI `/health` + CI（ruff / mypy / pytest / import-linter） | CI green |
| 2. コア実装（TDD） | domain → infra → usecase → presentation。ウォームアップ実装 | 全テスト green、カバレッジ 80%+ |
| 3. フロント改修 | `ImgSender.tsx` を FormData / blob 対応（C++ 版 PDR §3 と同一内容） | フロントのテスト green |
| 4. 統合検証 | Docker 化、docker-compose.dev.yml で新旧比較、同一画像セットで成否一致を確認 | 実ブラウザ操作で全フロー成功 |
| 5. 切り替え | compose / CI をフロント・バックエンド同時切り替え（契約変更のため片側のみ不可）。メモリ制限 2G 化 | 本番相当で動作確認、ベンチマーク取得 |
| 6. クリーンアップ | 旧 `server.py` / `stitch.py` / requirements.txt 削除、README 更新 | ドキュメント整合 |
| 7.（任意）性能追加 | 隣接ペア限定マッチング（`cv2.detail`）、Cloud Run デプロイ検証 | 多数枚ベンチマークで効果確認 |

ロールバック: フロント・バックエンドを**ペアで**旧タグに戻す（契約が変わるため片方のみは不可）。

## 10. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| FastAPI 化による挙動差（CORS・エラー形式） | フロント不整合 | 統合テストで契約を固定。Phase 4 で新旧比較 |
| opencv-python-headless / numpy 2.x への更新で stitch 挙動変化 | 合成品質の変化 | Phase 4 で同一画像セットの成否一致を確認 |
| 契約変更によるフロント・バック不整合 | 合成機能の全断 | 同時リリース・ペアロールバック徹底 |
| 大きなリクエストボディ | メモリ枯渇 | 100MB / 30 枚上限 + compose メモリ 2G |

## 11. C++ 移行 PDR との関係

C++ 版 PDR（multipart 契約・レイヤ設計・ベンチマーク・カスタムビルド付録）は**保留**として保持する。本 PDR の設計は C++ 版と同型のため、将来移行する場合は設計をそのまま翻訳できる。再開を検討するトリガー:

1. 512MB 級の無料インスタンスに載せる必要が生じた（Python の常駐メモリが制約になる）
2. ゼロスケール環境でコールドスタート（Python は 5〜10 秒）が問題になった
3. サーバー自体を廃止する方向（OpenCV の WASM ビルド + 静的ホスティング）に進む場合は、C++ 版 PDR のカスタムビルド知見（§12）を WASM ビルドに転用する

## 12. 未決事項

1. **Web フレームワーク**: FastAPI（推奨）か Flask 3.x + gunicorn か — PR レビューで確定
2. **Cloud Run 等へのデプロイ**: 今回のスコープ外とし Phase 7 の検証のみとするか
