FROM node:16

# 作業ディレクトリを作成
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# ソースコードをすべてコピー
COPY . .

# 開発サーバーを起動
CMD ["npm", "start"]
