# ============================================
# Stage 1: Build dependencies
# ============================================
FROM python:3.12.14-slim-trixie AS builder

WORKDIR /build

COPY pyproject.toml ./
COPY src ./src

# opencv-python-headless のため GUI 系のシステムライブラリは不要
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# ============================================
# Stage 2: Production runtime
# ============================================
FROM python:3.12.14-slim-trixie AS production

WORKDIR /app

RUN addgroup --gid 1001 --system appgroup && \
    adduser --system --uid 1001 --gid 1001 appuser

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY gunicorn.conf.py ./

USER appuser
EXPOSE 5000

# 1 枚あたりの画素数上限 (合計画素数の上限 STITCH_MAX_TOTAL_PIXELS 以下にする)。
# OpenCV はヘッダの寸法で判定するため、高圧縮な巨大画像をメモリ確保前に拒否できる
# (OpenCV の既定は 2^30 画素 ≒ 3.2GB で、コンテナのメモリ上限を超える)
ENV OPENCV_IO_MAX_IMAGE_PIXELS=40000000

# start-period はワーカーごとの起動時ウォームアップ (ダミー画像の合成) を考慮
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# ワーカー数・タイムアウト・ログ設定は gunicorn.conf.py を参照
CMD ["gunicorn", "-c", "gunicorn.conf.py", "src.main:app"]
