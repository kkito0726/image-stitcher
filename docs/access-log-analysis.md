# アクセスログから利用状況を集計する

- 作成日: 2026-09-27
- 対象: `docker-compose.deploy.yml` で運用している frontend (nginx) のアクセスログ

「特定の 1 人が使っているのか、複数人が使っているのか」を把握するための手順。

## 1. 何を記録しているか

nginx のアクセスログ (`frontend/nginx.conf` の `log_format main`) は 1 リクエスト 1 行で、次の形式になる。

```
[27/Sep/2026:10:15:02 +0900] "POST /api/stitch HTTP/1.1" 200 429757 1.283 "Mozilla/5.0 (...)" client=3f9a1c2e-8b4d-4e6f-9a0b-1c2d3e4f5a6b
```

| 項目 | 内容 |
|------|------|
| 時刻・メソッド・パス・ステータス・レスポンスサイズ・処理時間 (秒) | 障害対応用 |
| User-Agent | ブラウザの種類 |
| `client=` | ブラウザごとの匿名 ID |

- **匿名 ID**
  - フロントエンドがブラウザの localStorage に保存するランダムな UUID (`frontend/src/lib/clientId.ts`)。
  - 合成リクエスト (`POST /api/stitch`) のときだけ `X-Client-Id` ヘッダーで送られる。それ以外の行は `client=-` になる。
  - UUID の形式でない値も `-` として記録する。
- **記録しないもの**
  - IP アドレス。
  - ダウンロード URL に含まれる結果 ID (`/api/stitch/***/download` のように伏せる)。
- **例外: エラーログ**
  - nginx のエラーログ (同じ `docker logs` に出る) は形式が固定で、接続元のアドレスとリクエスト行を含む。
  - 通常時の警告は出ないよう `error` レベルにしているが、バックエンドの再起動中の接続失敗や、上限を超えるアップロードなど、本物のエラー時には出る。
  - Cloudflare Tunnel 経由の本番構成では、接続元は cloudflared コンテナなので利用者の IP ではない。LAN で直接公開している場合は利用者の IP になる。
- **利用者への表示**: 画面のフッター (`frontend/src/app/layout.tsx`)。記録内容を変えたらここも更新する。

## 2. 集計コマンド

`docker-compose.deploy.yml` のディレクトリで実行する。

匿名 ID ごとの合成回数:

```sh
docker compose -f docker-compose.deploy.yml logs --no-log-prefix image-stitcher-frontend \
  | grep '"POST /api/stitch' | grep -o 'client=[0-9a-f-]\{36\}' | sort | uniq -c | sort -rn
```

日ごとの利用ブラウザ数 (匿名 ID の種類の数):

```sh
docker compose -f docker-compose.deploy.yml logs --no-log-prefix image-stitcher-frontend \
  | grep '"POST /api/stitch' \
  | sed -n 's/^\[\([0-9]*\/[A-Za-z]*\/[0-9]*\):.*client=\([0-9a-f-]\{36\}\).*/\1 \2/p' \
  | sort -u | cut -d' ' -f1 | uniq -c
```

匿名 ID ごとの User-Agent (同じ人の PC とスマホの見分けの参考):

```sh
docker compose -f docker-compose.deploy.yml logs --no-log-prefix image-stitcher-frontend \
  | grep '"POST /api/stitch' | grep -o '"[^"]*" client=[0-9a-f-]\{36\}' | sort | uniq -c
```

## 3. 数字の読み方

匿名 ID の数は「使われたブラウザの数」であり、人数そのものではない。

- **多く数えるケース**: 1 人が PC とスマホで使う、ブラウザのデータを消す、プライベートブラウズを使う (ストレージが使えなければヘッダーは送られない)。
- **少なく数えるケース**: 共用 PC の同じブラウザを複数人で使う。
- **偽装**: ヘッダーは利用者が自由に送れるため、意図的に別の ID を送られると数は水増しされうる。興味の範囲の集計として扱う。
- **目安**: ID が 1〜2 種類で User-Agent も同じなら、ほぼ特定の 1 人。種類が増えていくなら複数人が使っている。

## 4. 保存期間

- ログは docker の json-file に出力され、`docker-compose.deploy.yml` の設定で 10MB × 3 ファイルまで保持して、古いものから上書きされる。
- アクセスが少ないと数か月分残ることもあるが、期間は保証されない。
- 長期の推移を見たい場合は、ログそのものではなく上の集計結果 (日付と件数) だけを定期的に書き出して残す。
