# Image Stitcher

顕微鏡画像の同士を重ね合わせて視野の広い顕微鏡画像を作成する

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
docker compose up -d --build
```

## アップデート

```bash
cd ~/Workspace/image-stitcher
git pull
docker compose up -d --build
```
