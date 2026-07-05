# PDR: 0 円本番運用(URL アクセスのみで利用可能なホスティング)

- ステータス: Draft
- 作成日: 2026-07-05
- 対象: ユーザーが Docker を使わず、URL を開くだけでアプリを利用できる 0 円のホスティング構成
- 関連文書: [PDR-python-backend-modernization.md](./PDR-python-backend-modernization.md)(実装済み)、[PDR-cpp-backend-migration.md](./PDR-cpp-backend-migration.md)(保留)
- 補足: Python 近代化 PDR §12 の「クラウドデプロイはスコープ外」決定を本 PDR で上書きする

---

## 1. 背景と要件

現行の配布方式(ghcr.io + ユーザーが `docker compose up`)は運用 0 円だが、利用者に Git / Docker のセットアップを要求する。これを「**URL を開くだけ**」にしつつ、**運用コストを限りなく 0 円に保つ**。

### 要件

| # | 要件 | 補足 |
|---|------|------|
| R1 | ユーザーは URL アクセスのみで全機能を利用できる | インストール・ログイン不要 |
| R2 | 月額 0 円(または実質 0 円)で運用できる | 想定規模: 研究室内、月数百合成以下 |
| R3 | 現行のローカル Docker 構成も開発用に維持する | 二重管理を最小化する |
| R4 | 合成品質・API 契約は変更しない | multipart 契約(100MB / 30 枚)を維持 |

## 2. 選択肢の比較

| 構成 | 月額 | URL のみ | 運用の手間 | 主な弱点 |
|------|------|---------|-----------|---------|
| **A. Cloud Run + GitHub Pages(推奨)** | 0 円(注 1) | ○ | ほぼゼロ(マネージド) | アイドル後のコールドスタート 10 秒前後 |
| B. Oracle Cloud Always Free VM | 0 円 | ○ | VM・TLS・ドメイン・パッチの自己管理 | 運用負担。無料 ARM 枠は確保競争がある |
| C. OpenCV を WASM 化 + GitHub Pages のみ | 0 円 | ○ | ゼロ(サーバー消滅) | opencv.js カスタムビルドの構築コストが大きい。WASM は native 比 2〜3 倍遅い |

注 1: GCP は請求先アカウント(クレジットカード登録)が必要。無料枠内なら請求は発生しないが、「カード登録なしで 0 円」ではない点が唯一の留保。

**推奨は A**。理由:

- バックエンドはコンテナ(352MB イメージ)がそのまま動く。**追加実装がほぼ不要**
- Cloud Run はゼロスケール(利用がない時間は課金対象ゼロ)で、無料枠が想定規模の 50〜100 倍ある(§4)
- フロントは Next.js が既に `output: "export"` の静的エクスポート構成なので、GitHub Pages にそのまま載る
- C(WASM)は長期の理想形だが工数が C++ 移行並み。A を先に出し、C は将来の選択肢として保留 PDR 群と同列に扱う

## 3. アーキテクチャ(案 A)

```
ユーザーのブラウザ
  │  https://kkito0726.github.io/image-stitcher/   (静的フロント)
  ▼
GitHub Pages (無料・public リポジトリ)
  │  POST {API_BASE}/stitch  (multipart, CORS)
  ▼
Cloud Run (min-instances=0, max-instances=1)
  └─ 既存の backend イメージ (FastAPI + gunicorn, 352MB)
```

- デプロイは GitHub Actions から: フロントは Pages へ、バックエンドは Artifact Registry へ push して Cloud Run にデプロイ(Workload Identity Federation 使用、キーレス)
- ローカル Docker 構成(R3)は現行どおり維持。フロントの API 向き先を環境変数で切り替える(§5)

## 4. 無料枠の収支計算

Cloud Run の恒久無料枠(執筆時点。セットアップ時に最新の料金表で要再確認):

| リソース | 無料枠/月 | 1 合成あたりの消費(実測ベース: 約 5 秒 × 2vCPU / 2GiB) | 無料枠で可能な合成回数 |
|----------|----------|--------------------------------------------------|---------------------|
| リクエスト | 200 万回 | 1 回 | 200 万回 |
| vCPU 時間 | 180,000 vCPU 秒 | 約 10 vCPU 秒 | **約 18,000 回** |
| メモリ時間 | 360,000 GiB 秒 | 約 10 GiB 秒 | 約 36,000 回 |

想定規模(月数百合成)は無料枠の **1〜2%**。10 倍に増えても余裕がある。

**残る費用リスクはネットワーク下り(合成結果 PNG の送信)のみ**:

- 北米リージョン(us-west1 等)は月 1GB まで下り無料 → 月数百合成 × 数 MB なら 0 円
- 東京リージョン(asia-northeast1)は下りが従量課金(1GB あたり十数円)→ 厳密 0 円ではなく「月数円〜数十円」
- レイテンシ差(+100ms 程度)は数秒かかる合成処理では体感不能のため、**厳密 0 円を優先して us-west1 を推奨**(§9 決定事項)

GitHub Pages / Actions は public リポジトリのため無料。

## 5. 必要な実装変更(小規模)

### 5.1 バックエンド

1. **CORS オリジンの環境変数化**: `Settings.allowed_origins` を `ALLOWED_ORIGINS`(カンマ区切り)で上書き可能にし、Cloud Run デプロイ時に GitHub Pages のオリジンを追加する

### 5.2 フロントエンド

2. **API ベース URL の環境変数化**: `NEXT_PUBLIC_API_BASE_URL` をビルド時に注入。未設定時は現行の `/api`(nginx プロキシ)にフォールバック → ローカル Docker 構成(R3)と共存
3. **GitHub Pages の basePath 対応**: プロジェクトページ(`/image-stitcher/`)配下で動くよう `basePath` をビルド時に切り替え
4. **プリウォーム ping**: トップページ表示時に `GET {API_BASE}/health` を 1 回発火する。ユーザーが画像を選んでいる数十秒の間にコールドスタート(§6)を消化させ、体感遅延をほぼゼロにする

### 5.3 CI/CD(GitHub Actions)

5. `deploy-pages.yml`: main への push で `next build` → GitHub Pages デプロイ
6. `deploy-cloudrun.yml`: main への push で backend イメージを Artifact Registry へ push → Cloud Run デプロイ(Workload Identity Federation でキーレス認証)

## 6. コールドスタートの扱い

min-instances=0(0 円の必須条件)のため、アイドル後の初回リクエストで「コンテナ起動 + ウォームアップ」が走る。見込み 10 秒前後(352MB イメージの pull + gunicorn 起動 + ダミー合成。デプロイ後に実測する)。

緩和策:

- §5.2-4 のプリウォーム ping(実装 1 行。画像選択の間に起動が終わる)
- ウォームアップ済み構成のため、起動後の初回合成は遅くならない(近代化 PR で対応済み)
- フロントには処理中スピナーが既にあり、まれに ping が間に合わない場合も UX は破綻しない

min-instances=1 にすればコールドスタートは消えるが、常時課金となり 0 円要件に反するため不採用。

## 7. コスト・悪用ガードレール

公開 URL になるため、コストと可用性の上限を設定で固定する:

| 設定 | 値 | 目的 |
|------|-----|------|
| max-instances | 1 | 暴走・悪用時でも同時 1 コンテナ以上は起動しない(コスト上限の固定) |
| concurrency | 2 | CPU バウンド処理のため少数に制限 |
| request timeout | 300s | 巨大リクエストの滞留防止 |
| GCP 予算アラート | 100 円 | 想定外の課金を即検知(メール通知) |
| リクエスト上限 | 既存の 100MB / 30 枚 | アプリ層のバリデーション(実装済み) |

最悪ケースでも「無料枠を使い切って 503 になる」方向に倒れ、高額請求には至らない。認証(トークン・Turnstile 等)は本 PDR ではスコープ外とし、悪用が実際に観測されたら追加する。

## 8. 移行計画

| Phase | 内容 | 完了条件 |
|-------|------|----------|
| 1. コード変更 | §5.1〜4(CORS env 化、API base env 化、basePath、プリウォーム ping) | ローカル Docker 構成で回帰なし(R3) |
| 2. GCP セットアップ(手動) | プロジェクト作成、Artifact Registry、Workload Identity Federation、予算アラート | 手順を docs に記録 |
| 3. デプロイ CI | `deploy-pages.yml` / `deploy-cloudrun.yml` 追加 | main push で両方が自動デプロイされる |
| 4. 検証 | コールドスタート実測、実ブラウザで一連フロー、CORS 確認 | Pages URL から合成〜ダウンロード成功 |
| 5. 公開 | README に利用 URL を記載。ローカル Docker 手順は開発者向けセクションへ移動 | ドキュメント整合 |

ロールバック: DNS 等を持たないため、README から URL 案内を外し従来のローカル Docker 案内に戻すだけ。Cloud Run サービスの削除で課金要素も消える。

## 9. 決定が必要な事項

1. **GCP アカウント(クレジットカード登録)の可否** — 案 A の前提。不可なら案 B(Oracle)または案 C(WASM)に切り替え
2. **リージョン**: us-west1(厳密 0 円・推奨)か asia-northeast1(月数円〜数十円・国内レイテンシ)か
3. **フロントの公開 URL**: `kkito0726.github.io/image-stitcher`(推奨・追加アカウント不要)か、Cloudflare Pages(独自ドメイン相当の柔軟性)か

## 10. 将来の発展(スコープ外)

- **案 C(WASM 化)**: サーバー自体を廃止する終着点。opencv.js のカスタムビルド(stitching モジュール入り)が必要で、C++ 移行 PDR §12 のビルド知見を転用できる。Cloud Run 運用に不満が出た時点で再検討
- 認証・悪用対策(Cloudflare Turnstile 等): 悪用の実観測をトリガーに追加
