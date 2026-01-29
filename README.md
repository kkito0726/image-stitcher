# Image Stitcher

顕微鏡画像同士を重ね合わせて視野の広い顕微鏡画像を作成する

## 環境構築 (終わっていたら飛ばす)

1. [Git install](https://qiita.com/T-H9703EnAc/items/4fbe6593d42f9a844b1c)
2. [Docker Desktop install](https://docs.docker.com/get-docker/)
3. Docker Desktop を起動した状態で、git bash (Git インストール時に同時に入る)で以下のコマンドを実行

## インストール

### リポジトリのクローン (初回のみ)

```bash
mkdir ~/Workspace
cd ~/Workspace
git clone https://github.com/kkito0726/image-stitcher.git
```

### Docker コンテナの起動

```bash
cd ~/Workspace/image-stitcher
docker compose up -d
```

ブラウザで http://localhost:3000 にアクセス

### コンテナの停止

```bash
docker compose -f ~/Workspace/image-stitcher/docker-compose.yml stop
```

## アップデート

```bash
cd ~/Workspace/image-stitcher
git pull
docker compose pull
docker compose up -d
```

### 古いイメージの削除

ローカルビルドで作成した古いイメージを削除する場合:

```bash
docker rmi image-stitcher-image-stitcher-backend image-stitcher-image-stitcher-frontend
```

未使用のイメージをすべて削除する場合:

```bash
docker image prune -a
```

## オペレーションフロー

```
開発者がコードを更新
       ↓
main ブランチにマージ
       ↓
GitHub Actions が自動でビルド
       ↓
Docker イメージが ghcr.io に公開
       ↓
ユーザーが docker compose pull で最新イメージを取得
```

## 開発者向け

### ローカルでビルドして起動

```bash
cd ~/Workspace/image-stitcher
docker compose -f docker-compose.dev.yml up -d --build
```

### 主要コマンド

| コマンド | 説明 |
|---------|------|
| `docker compose up -d` | 公開イメージで起動 |
| `docker compose -f docker-compose.dev.yml up -d --build` | ローカルビルドして起動 |
| `docker compose down` | コンテナ停止・削除 |
| `docker compose logs -f` | ログを表示 |
