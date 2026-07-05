# PDR: バックエンドの C++ 移行（単一バイナリ化）

- ステータス: **保留（Deferred）** — 事前実測（§9.1）により C++ 移行単体のレイテンシ改善が 1.1〜1.2 倍にとどまると判明したため、[Python 近代化案](./PDR-python-backend-modernization.md)を先行する。再開トリガーは同文書 §11 を参照
- 作成日: 2026-07-05
- 対象: `backend/`（Flask + opencv-python）→ C++ 単一バイナリへの置き換え

---

## 1. 背景と目的

### 現状

バックエンドは Python (Flask) + opencv-python で構成され、`cv2.Stitcher` による画像スティッチングを提供している。

- `backend/server.py`: Flask サーバー。Base64 デコード → スティッチ → PNG エンコード → Base64 返却
- `backend/stitch.py`: `cv2.Stitcher`（SCANS / PANORAMA モード）の薄いラッパー
- Docker イメージは python:3.12-slim ベースで、site-packages（opencv-python 含む）を同梱

### 課題

| 課題 | 詳細 |
|------|------|
| 実行速度 | Base64 デコード、`np.asarray` 変換、リスト操作などが Python インタープリタ上で実行される。リクエストごとのオーバーヘッドが大きい |
| メモリ | Python ランタイム + numpy + opencv-python の常駐メモリが大きい（compose 上で 1G 制限） |
| イメージサイズ | Python ランタイムと site-packages の同梱でイメージが肥大化 |
| 起動時間 | インタープリタ起動 + モジュールロードが遅く、ヘルスチェック start_period が必要 |
| 構造 | レイヤ分離がなく、HTTP 処理・エンコード処理・スティッチ処理が密結合 |

### 目的

1. **速度改善**: C++ 単一バイナリ化により、リクエスト処理のオーバーヘッド（デコード / エンコード / メモリコピー）を削減する
2. **フットプリント削減**: ランタイム不要の単一バイナリで、Docker イメージとメモリ使用量を削減する
3. **保守性向上**: クリーンアーキテクチャを採用し、domain 層のインターフェースと infra 層の実装を分離する

### 期待効果と正直な見積もり

スティッチング本体（特徴点検出・マッチング・合成）は Python 版でも OpenCV の C++ 実装が動いているため、**コア処理自体の高速化は限定的**。改善が見込まれるのは:

- Base64 の廃止（multipart 化）による転送サイズ約 25% 削減と、エンコード / デコード往復の完全な排除
- バイト列 → Mat 変換のオーバーヘッド（Python ループ + numpy コピーの排除）
- プロセス起動時間（数秒 → 数十ms）
- 常駐メモリ（数百 MB → 数十 MB 程度を想定）
- Docker イメージサイズ（≈1GB → 100〜200MB 程度を想定。静的リンク構成ならさらに小さく）

移行前後で `/stitch` のレイテンシとメモリをベンチマークし、効果を定量評価する（§9）。

---

## 2. スコープ

### In Scope

- `backend/` の C++ による再実装
- **API 契約の刷新**: Base64 in JSON → multipart/form-data リクエスト + PNG バイナリレスポンス（§3）
- 契約変更に伴うフロントエンド送受信部の改修（`ImgSender.tsx` と画像選択まわり）
- クリーンアーキテクチャによるレイヤ設計
- CMake ビルド、Docker マルチステージビルド、GitHub Actions CI/CD の更新
- ユニットテスト / 統合テストの整備

### Out of Scope

- 機能追加（トリミングはフロント側の機能のため対象外）
- Python 版の機能拡張

---

## 3. API 契約（新契約）

Base64 in JSON は転送サイズ +33% とエンコード/デコード往復のオーバーヘッドがあるため、C++ 移行と同時に **multipart/form-data + バイナリレスポンス**へ刷新する。**破壊的変更**のため、フロントエンド改修と同時リリースが必要（§8）。

### プロトコル選定メモ

Connect RPC / gRPC も検討したが不採用。理由: (1) Connect RPC に C++ サーバーの公式実装がない、(2) gRPC C++ サーバーはブラウザから直接叩けず Envoy 等のプロキシが必要になり、エンドポイント実質1つの構成には過剰、(3) Protobuf の `bytes` フィールドで画像を運ぶことになり multipart と比べた利点がない。ブラウザ標準の `FormData` がそのまま使える multipart が最適。

### `GET /health`

```json
200 {"status": "healthy"}
```

### `POST /stitch`

Request:

```
Content-Type: multipart/form-data

  mode:   "Scans" | "Panorama"   （テキストフィールド）
  images: File × N               （画像バイナリ。JPEG/PNG 等、cv::imdecode が扱える形式）

上限: images は最大 30 枚、リクエストボディ全体で最大 100MB（超過は 400）
```

Response:

| ケース | ステータス | Content-Type | ボディ |
|--------|-----------|--------------|--------|
| 合成成功 | 200 | `image/png` | 合成画像の PNG バイナリ |
| 合成失敗（特徴点不足など） | 422 | `application/json` | `{"isStitched": 1, "reason": "need_more_images"}` |
| リクエスト不正（フィールド欠落・画像デコード不可・上限超過） | 400 | `application/json` | `{"error": "<内容>"}` |
| 予期しない内部エラー | 500 | `application/json` | `{"error": "internal server error"}` |

- フロントは HTTP ステータスで成功 / 失敗を判定する（`isStitched` 数値比較への依存を廃止）
- `mode` が `"Scans"` 以外の値は Panorama として扱う（現行実装と同一挙動）
- CORS: `http://localhost:3000`, `http://image-stitcher-frontend` を許可（現行と同一）

### `GET /`

`"Server!"` を返す（疎通確認用。互換のため維持）。

### フロントエンド側の変更

- 画像選択: `File` オブジェクトをそのまま state に保持し、`FormData` に append して送信（現在の「ファイルを Base64 文字列化して保持」を廃止 → ブラウザ側メモリも削減）
- プレビュー: `URL.createObjectURL(file)` を使用（`data:` URL より大画像に強い。不要になったら `revokeObjectURL`）
- 受信: `axios.post(url, formData, { responseType: "blob" })` → `URL.createObjectURL(blob)` で表示・ダウンロード
- エラー表示: 422 レスポンスの `reason` で分岐

---

## 4. 技術選定

| 項目 | 選定 | 理由 / 代替案 |
|------|------|--------------|
| 言語 | C++17 | OpenCV 4.x の要求水準を満たし、主要コンパイラで安定 |
| 画像処理 | OpenCV 4.x (C++) — `stitching`, `imgcodecs`, `core` モジュール | 現行と同一アルゴリズム (`cv::Stitcher`) で挙動互換を保証 |
| HTTP サーバー | **cpp-httplib**（ヘッダオンリー） | 依存最小で単一バイナリ向き。multipart/form-data のパースをネイティブサポート。エンドポイント2つの規模に Drogon / Crow は過剰。スレッドプール内蔵で並列リクエストにも対応 |
| JSON | **nlohmann/json**（ヘッダオンリー） | エラーレスポンス・ヘルスチェック用。デファクト標準 |
| RPC フレームワーク | 不採用（素の HTTP + multipart） | Connect RPC は C++ サーバー公式実装なし、gRPC はブラウザ直結不可でプロキシが必要。§3 参照 |
| ビルド | CMake 3.22+ / FetchContent | ヘッダオンリー依存は FetchContent で取得。OpenCV はビルドステージで apt / ソースビルド |
| テスト | GoogleTest + GoogleMock | domain インターフェースのモックに gMock を使用 |
| Docker | multi-stage: ビルダー（gcc + OpenCV）→ ランタイム（debian-slim + OpenCV 共有ライブラリのみ） | まず動的リンクで移行し、Phase 7 で OpenCV 静的リンク + distroless 化（§12） |

**単一バイナリの定義**: 移行時点（Phase 1〜6）では「Python ランタイム・スクリプト不要の実行ファイル1つ + OpenCV 共有ライブラリ」とする。完全静的リンク（真の単一ファイル）は OpenCV の静的ビルドが必要なため Phase 7 の改善項目とする（§12）。

---

## 5. アーキテクチャ設計

### 5.1 レイヤ構成（依存の向き）

```
presentation ──▶ usecase ──▶ domain ◀── infra
     │                          ▲
     └──────── main (DI: 依存の組み立て) ────────┘
```

- **domain**: エンティティ・値オブジェクト・**インターフェース（ポート）**。他レイヤへの依存なし。OpenCV / HTTP / JSON の型を一切含まない
- **usecase**: ユースケース実装。domain のインターフェースにのみ依存
- **infra**: domain インターフェースの実装（アダプタ）。OpenCV への依存はここに閉じ込める
- **presentation**: HTTP ハンドラ、DTO、JSON シリアライズ。usecase を呼び出す
- **main**: エントリポイント。infra 実装を生成して usecase / presentation に注入する（Composition Root）

### 5.2 ディレクトリ構成

```
backend-cpp/
├── CMakeLists.txt
├── Dockerfile
├── src/
│   ├── main.cpp                        # Composition Root（DI 組み立て、サーバー起動）
│   ├── domain/
│   │   ├── model/
│   │   │   ├── image.hpp               # RawImage（バイト列）/ DecodedImage（抽象画像）
│   │   │   ├── stitch_mode.hpp         # enum class StitchMode { Scans, Panorama }
│   │   │   └── stitch_result.hpp       # StitchResult（status + 画像 or 失敗理由）
│   │   └── repository/                 # ポート（インターフェース）
│   │       ├── i_image_stitcher.hpp    # 純粋仮想: stitch(images, mode) -> StitchResult
│   │       └── i_image_codec.hpp       # 純粋仮想: decode(bytes) / encodePng(image)
│   ├── usecase/
│   │   └── stitch_images_usecase.hpp/.cpp
│   │                                   # decode → stitch → encode のオーケストレーション
│   ├── infra/
│   │   └── opencv/
│   │       ├── cv_image.hpp            # DecodedImage の cv::Mat 実装
│   │       ├── cv_image_stitcher.hpp/.cpp   # IImageStitcher 実装（cv::Stitcher）
│   │       └── cv_image_codec.hpp/.cpp      # IImageCodec 実装（imdecode/imencode）
│   └── presentation/
│       ├── http_server.hpp/.cpp        # cpp-httplib のルーティング・CORS 設定
│       ├── dto/
│       │   ├── stitch_request.hpp      # multipart（mode + images[]）の取り出しとバリデーション
│       │   └── stitch_response.hpp     # PNG バイナリ / エラー JSON の構築
│       └── handler/
│           ├── health_handler.hpp/.cpp
│           └── stitch_handler.hpp/.cpp
└── test/
    ├── domain/                         # 値オブジェクトのテスト
    ├── usecase/                        # gMock によるユースケーステスト
    ├── infra/                          # base64 / codec / stitcher の実テスト
    ├── presentation/                   # DTO パース・バリデーションのテスト
    └── fixtures/                       # テスト用重なり画像（小サイズ）
```

### 5.3 domain 層インターフェース（ポート）

```cpp
// domain/repository/i_image_stitcher.hpp
// OpenCV 非依存。domain 型のみを使う
class IImageStitcher {
public:
  virtual ~IImageStitcher() = default;
  virtual StitchResult stitch(const std::vector<std::shared_ptr<DecodedImage>>& images,
                              StitchMode mode) const = 0;
};

// domain/repository/i_image_codec.hpp
class IImageCodec {
public:
  virtual ~IImageCodec() = default;
  virtual std::shared_ptr<DecodedImage> decode(const std::vector<uint8_t>& bytes) const = 0;
  virtual std::vector<uint8_t> encodePng(const DecodedImage& image) const = 0;
};
```

`DecodedImage` は domain 層の抽象クラスとし、`cv::Mat` を保持する具象クラス `CvImage` は infra 層に置く。これにより domain / usecase は OpenCV ヘッダを一切 include しない。

### 5.4 usecase 層

```cpp
// usecase/stitch_images_usecase.hpp（概略）
class StitchImagesUseCase {
public:
  StitchImagesUseCase(std::shared_ptr<const IImageCodec> codec,
                      std::shared_ptr<const IImageStitcher> stitcher);

  // 画像のバイト列（multipart から取り出したもの）を受け取り、PNG バイト列を返す
  StitchImagesOutput execute(const StitchImagesInput& input) const;
};
```

- 入出力は usecase 専用の Input/Output 構造体（presentation の DTO とは分離）
- ステートレス・イミュータブル（メンバは `shared_ptr<const T>`、メソッドは `const`）

### 5.5 エラーハンドリング方針

| エラー | HTTP | レスポンス |
|--------|------|-----------|
| スティッチ失敗（`cv::Stitcher::Status` が 0 以外） | 422 | `{"isStitched": 1, "reason": "need_more_images" \| "homography_estimation_failed" \| "camera_params_adjust_failed"}` |
| multipart 不正 / `images` 欠落・0枚 / `mode` 欠落 / 画像デコード失敗 / サイズ・枚数上限超過 | 400 | `{"error": "<内容>"}` |
| OpenCV 例外などの予期しない失敗 | 500 | `{"error": "internal server error"}`（詳細はログのみ。レスポンスに内部情報を漏らさない） |

現行 Python 版は `cv::Stitcher` が 0/1 以外の status を返すと `None` を返して 500 になる潜在バグがある。C++ 版では status 0 以外をすべて 422 に集約し、`reason` で失敗種別を伝える（`cv::Stitcher::Status` の enum に対応）。

### 5.6 起動時ウォームアップ

事前計測（§9）で、プロセス起動後の**初回 stitch のみ約 6 倍遅い**（内部初期化のため）ことが判明した。C++ サーバーは起動時に同梱のダミー画像で stitch を一度実行し、初期化を済ませてからヘルスチェックを healthy にする。これによりユーザーの初回リクエストが初期化コストを踏まない。

### 5.7 並行処理

- cpp-httplib のデフォルトスレッドプールを使用（リクエストごとにワーカースレッド）
- `cv::Stitcher` インスタンスはリクエストごとに生成（`cv::Stitcher` はステートフルなため共有しない）
- 共有状態を持たない設計のため、ロックは不要

---

## 6. ビルドとデプロイ

### 6.1 CMake 構成

- `domain` / `usecase` / `infra` / `presentation` を静的ライブラリターゲットに分割し、リンク関係でレイヤ依存を強制する
  - 例: `usecase` は `domain` にのみ `target_link_libraries` する → infra への誤依存はリンクエラーになる
- cpp-httplib / nlohmann/json / GoogleTest は `FetchContent` で取得（バージョン固定）
- Release ビルド: `-O2`、`-DNDEBUG`

### 6.2 Dockerfile（multi-stage）

```dockerfile
# Stage 1: build — gcc + cmake + libopencv-dev でビルド
# Stage 2: runtime — debian:stable-slim + OpenCV ランタイム共有ライブラリ + バイナリのみ
#           非 root ユーザー（uid 1001、現行と同じ）で実行
```

- ヘルスチェックは `curl` 等の追加を避けるため、バイナリ自身に `--healthcheck` フラグを実装（`/health` を自己呼び出しして exit code を返す）か、静的リンクの `wget` 相当を同梱
- `EXPOSE 5000`、ポート・ネットワーク構成は現行 docker-compose と同一

### 6.3 CI/CD（GitHub Actions）

- 既存の Docker ビルド & ghcr.io push ワークフローの backend 対象を `backend-cpp/` に切り替え
- PR 時: ビルド + ユニットテスト + 統合テストを実行
- イメージタグ戦略は現行踏襲（`latest`）

---

## 7. テスト計画

| レイヤ | 種別 | 内容 |
|--------|------|------|
| domain | Unit | `StitchMode` 変換（"Scans" → Scans、その他 → Panorama）、`StitchResult` の状態 |
| infra/opencv | Unit | `CvImageCodec` の decode/encodePng ラウンドトリップ、壊れたバイト列の拒否 |
| usecase | Unit | gMock で `IImageStitcher` / `IImageCodec` をモックし、成功 / 失敗 / 例外パスを検証 |
| presentation | Unit | multipart リクエストの取り出し（`mode` / `images`）、バリデーション（欠落・0枚・上限超過）、エラー JSON の構築 |
| 統合 | Integration | サーバーを起動し、fixtures の重なり画像2枚で `POST /stitch` → 200 + デコード可能な PNG を検証。重ならない画像で 422 + `reason` を検証。境界（1枚・上限枚数・巨大ボディ）も確認 |
| 互換性 | E2E | **Python 版と C++ 版に同一の画像セットを与え、合成の成否が一致することを検証**（ゴールデンテスト。契約が異なるためリクエストはそれぞれの形式に変換して送る）。合成画像はアルゴリズムの非決定性があるためピクセル一致ではなく、デコード可能な PNG であること・サイズが近いことを確認 |
| フロント | E2E | 改修後のフロントから実ブラウザで選択 → 合成 → 表示 → ダウンロードの一連フロー（Playwright） |

カバレッジ目標: 80%+（gcov/lcov で計測、CI でレポート）。

---

## 8. 移行計画

| Phase | 内容 | 完了条件 |
|-------|------|----------|
| 1. 骨格構築 | `backend-cpp/` に CMake プロジェクト + レイヤ構造 + `/health` のみの HTTP サーバー | ローカルでビルド・起動・ヘルスチェック成功 |
| 2. コア実装（TDD） | domain → infra(opencv) → usecase → presentation の順にテストファーストで実装 | 全ユニットテスト green、カバレッジ 80%+ |
| 3. フロント改修 | `ImgSender.tsx` と画像選択まわりを `FormData` / `blob` 対応に改修（§3）。バックエンドと独立した PR | フロントのユニット・E2E テスト green |
| 4. 統合・互換検証 | Docker 化、docker-compose.dev.yml で新フロント + C++ 版を並行稼働、ゴールデンテスト実施 | 実ブラウザ操作で合成〜ダウンロード成功、Python 版と成否一致 |
| 5. 切り替え | docker-compose.yml / CI をフロント・バックエンド**同時に**切り替え（契約が変わるため片方だけの切り替えは不可）。旧イメージはタグを残す | 本番相当環境での動作確認、ベンチマーク取得 |
| 6. クリーンアップ | `backend/`（Python 版）削除、README 更新 | ドキュメント整合 |
| 7.（任意）最適化 | (a) OpenCV 静的リンクで完全単一バイナリ化・distroless 化・カスタムビルド（§12）、(b) 隣接ペア限定マッチング — `cv::Stitcher` の全ペア総当たり O(N²) を `cv::detail` API で隣接ペアに限定（20〜30枚時に数倍の見込み。§9 の実測で 12 枚時に stitch 時間が 5 枚時の 3.6 倍） | イメージサイズ・メモリの追加削減、多数枚時のレイテンシ削減 |

ロールバック: API 契約が変わるため、**フロント・バックエンドをペアで**旧タグに戻す（片方だけ戻すと契約不一致で動かない）。docker-compose の両イメージ指定を切り替え前のタグに戻すことで復旧する。

---

## 9. ベンチマーク計画

### 9.1 事前計測（2026-07-05、現行 Python パイプライン相当・ローカル計測）

3MP タイル画像・30% オーバーラップでの段階別内訳（絶対値より比率を参照）:

| 段階 | 5枚 | 12枚グリッド |
|------|-----|------------|
| 入力（Base64 + コピー + imdecode） | 42ms (6%) | 104ms (5%) |
| stitch 本体 | 460ms (69%) | 1666ms (79%) |
| PNG エンコード | 160ms (24%) | 306ms (15%) |
| Base64 エンコード（出力） | 10ms (1%) | 19ms (1%) |

主な知見:

- 処理時間の 85〜95% は `cv::Stitcher` / `imencode`（Python 版でも C++ 実行部）。**C++ 移行 + multipart 化単体のレイテンシ改善は 1.1〜1.2 倍程度**が誠実な見積もり。移行の主眼はメモリ・イメージサイズ・保守性・スループット
- **初回 stitch のみ約 6 倍遅い**（4.4s vs 0.6s、内部初期化）→ §5.6 の起動時ウォームアップで対処
- 12 枚で stitch 時間が 5 枚時の 3.6 倍（全ペアマッチング O(N²)）→ 多数枚時は Phase 7(b) の隣接ペア限定マッチングが最大の伸びしろ
- PNG 圧縮は OpenCV デフォルト設定が最速・最小（`IMWRITE_PNG_COMPRESSION=1` の明示指定はむしろ 2 倍遅い）
- 現行実装の `np.array(read_img)` はサイズの異なる画像で失敗する潜在バグあり。C++ の `std::vector<cv::Mat>` で自然に解消
- 上限 100MB 入力時、デコード後は数百 MB になるため compose のメモリ制限は 1G → 2G への引き上げを推奨

### 9.2 移行前後の計測項目

移行前後で以下を計測し、効果を定量化する:

- `POST /stitch` レイテンシ（2枚 / 5枚 / 10枚、各画像 2MP 程度、p50/p95）
- コンテナ起動 → healthy までの時間
- アイドル時 / 処理中のメモリ使用量（`docker stats`）
- Docker イメージサイズ

計測スクリプトは `backend-cpp/bench/` に配置し、再現可能にする。

---

## 10. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| `cv::Stitcher` の挙動差（OpenCV バージョン差） | 合成結果の品質変化 | Python 版と同系の OpenCV 4.x を使用。ゴールデンテストで検証 |
| コア処理が支配的で速度改善が小さい | 移行の費用対効果低下 | §1 で期待値を明示済み。ベンチマークで判断し、改善が小さくてもフットプリント削減・保守性向上は達成される |
| OpenCV の Docker ビルド時間増 | CI 時間増 | Phase 1 は apt の `libopencv-dev` を使用（ソースビルド回避）。ビルドキャッシュ活用 |
| C++ のメモリ安全性 | クラッシュ・脆弱性 | 生ポインタ禁止・RAII 徹底、`-fsanitize=address,undefined` を CI のテストで有効化。入力サイズ上限（リクエストボディ最大サイズ、画像枚数上限）を設ける |
| 大きなリクエストボディ（画像複数枚） | メモリ枯渇 | ボディサイズ上限 100MB・画像枚数上限 30 枚を presentation 層でバリデーション |
| API 契約変更によるフロント・バック不整合 | 合成機能の全断 | 同時リリース・ペアロールバックを徹底（§8）。切り替え前に dev compose で結合検証 |

---

## 11. 決定事項

1. **入出力方式**: multipart/form-data + PNG バイナリレスポンス（§3）— 2026-07-05 決定
2. **入力上限値**: リクエストボディ 100MB / 画像 30 枚 — 2026-07-05 決定
3. **旧 `backend/` の削除**: 今回の移行内（Phase 6）で即時削除。契約が変わるため併存の意味がない — 2026-07-05 決定
4. **OpenCV の入手方法**: Phase 1〜6 は apt (`libopencv-dev`) の動的リンク、Phase 7 でカスタムビルド静的リンク化（詳細は §12 付録）

---

## 12. 付録: OpenCV カスタムビルド（Phase 7）

### 12.1 なぜカスタムビルドか

apt の `libopencv-dev` は全モジュール + GUI / 動画系の依存（GTK、FFmpeg、GStreamer 等）を丸ごと引き込む。このアプリが実際に使うのはスティッチング経路のみなので、ソースから必要モジュールだけを静的ライブラリとしてビルドすれば:

- **完全単一バイナリ**: OpenCV を実行ファイルに埋め込み、`.so` の同梱・LD パス管理が不要になる
- **イメージ大幅削減**: ランタイムイメージが distroless ベースで数十 MB 程度になる見込み（動的リンク構成の数百 MB に対して）
- **攻撃面の縮小**: 使わないコーデック・GUI ライブラリの CVE 対応から解放される

処理速度への効果はほぼない（リンク形態は実行速度に影響しない）。目的はフットプリントと運用性。

### 12.2 必要モジュールの特定

`cv::Stitcher` の依存グラフから、ビルド対象は以下の 7 モジュールのみ:

| モジュール | 用途 |
|-----------|------|
| `core` | 基盤（Mat、メモリ管理） |
| `imgproc` | リサイズ・ワープ等の画像処理 |
| `imgcodecs` | `imdecode` / `imencode`（PNG / JPEG） |
| `flann` | 特徴点マッチングの近傍探索 |
| `features2d` | 特徴点検出（ORB / SIFT。SIFT は 4.4+ で本体に含まれる） |
| `calib3d` | ホモグラフィ推定・バンドル調整 |
| `stitching` | `cv::Stitcher` 本体 |

highgui / videoio / dnn / ml / photo / gapi / objdetect などは不要。

### 12.3 CMake 構成（ビルダーステージ）

```bash
cmake -S opencv -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DBUILD_LIST=core,imgproc,imgcodecs,flann,features2d,calib3d,stitching \
  -DBUILD_opencv_apps=OFF -DBUILD_TESTS=OFF -DBUILD_PERF_TESTS=OFF \
  -DBUILD_EXAMPLES=OFF -DBUILD_DOCS=OFF -DBUILD_JAVA=OFF \
  -DBUILD_opencv_python3=OFF \
  -DWITH_GTK=OFF -DWITH_QT=OFF -DWITH_FFMPEG=OFF -DWITH_GSTREAMER=OFF \
  -DWITH_V4L=OFF -DWITH_CUDA=OFF -DWITH_OPENCL=OFF \
  -DWITH_PNG=ON -DWITH_JPEG=ON \
  -DWITH_TIFF=OFF -DWITH_WEBP=OFF -DWITH_OPENEXR=OFF -DWITH_JASPER=OFF \
  -DBUILD_PNG=ON -DBUILD_JPEG=ON -DBUILD_ZLIB=ON \
  -DWITH_IPP=ON \
  -DCMAKE_INSTALL_PREFIX=/opt/opencv
```

要点:

- `BUILD_LIST` で 7 モジュールに限定（依存モジュールは自動解決される）
- `BUILD_PNG/JPEG/ZLIB=ON` でコーデックも OpenCV 同梱版を静的ビルド → システムライブラリ依存を消す
- 入力形式を PNG / JPEG に限定（TIFF / WebP 等を落とす）。§3 の対応形式にも反映すること
- `WITH_IPP=ON`（x86_64）: Intel IPP-ICV による SIMD 最適化。OpenCV 同梱で再配布可。ARM ビルドでは無効になり NEON 最適化が自動適用される
- CPU 分散ディスパッチ（AVX2 等）は OpenCV が実行時に自動判定するため、`CPU_BASELINE` はデフォルト（SSE3 相当）のままにして互換性を確保

### 12.4 アプリ側のリンクとランタイムイメージ

```cmake
# アプリの CMake: 静的 OpenCV + ランタイムの静的化
set(OpenCV_STATIC ON)
find_package(OpenCV REQUIRED COMPONENTS core imgproc imgcodecs stitching)
target_link_libraries(app PRIVATE ${OpenCV_LIBS})
target_link_options(app PRIVATE -static-libstdc++ -static-libgcc)
```

- glibc の完全静的リンクは非推奨（NSS 問題）のため、**distroless の `cc` イメージ**（glibc + libstdc++ 最小構成）をランタイムに使う:

```dockerfile
FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=builder /app/build/app /app
EXPOSE 5000
ENTRYPOINT ["/app", "--port", "5000"]
```

- distroless にはシェルがないため、ヘルスチェックはバイナリ自身の `--healthcheck` フラグ（§6.2）が必須になる

### 12.5 CI ビルド時間対策

OpenCV のソースビルドは CI で 10〜20 分かかる。毎 PR で走らせないために:

1. **ビルダーベースイメージ方式（推奨）**: OpenCV 静的ライブラリ入りのビルダーイメージを別ワークフローで月次 or OpenCV 更新時にビルドし、`ghcr.io/kkito0726/opencv-static-builder:<opencv-version>` として push。アプリの CI はこれを `FROM` に使うため、アプリのビルドは数十秒で済む
2. 代替: GitHub Actions cache に OpenCV ビルド成果物をキャッシュ（キー = OpenCV バージョン + CMake フラグのハッシュ）。cache miss 時が遅い点に注意

### 12.6 リスク

| リスク | 対策 |
|--------|------|
| BUILD_LIST 構成で必要シンボル欠落（リンクエラー） | Phase 1〜6 の統合テスト一式をそのまま流して検証（挙動はリンク形態に依存しないため既存テストで十分） |
| コーデック限定により受理形式が変わる（TIFF 等が 400 になる） | §3 の対応形式を「PNG / JPEG」と明記し、フロントの accept 属性も一致させる |
| ビルダーイメージの更新忘れ（OpenCV の CVE 追従漏れ） | Dependabot / 月次ワークフローで OpenCV リリースを監視し、ビルダーイメージを再ビルド |
