# ============================================
# Stage 1: Build dependencies
# ============================================
FROM python:3.12-slim AS builder

WORKDIR /build

COPY pyproject.toml ./
COPY src ./src

# opencv-python-headless のため GUI 系のシステムライブラリは不要
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# ============================================
# Stage 2: Production runtime
# ============================================
FROM python:3.12-slim AS production

WORKDIR /app

RUN addgroup --gid 1001 --system appgroup && \
    adduser --system --uid 1001 --gid 1001 appuser

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

USER appuser
EXPOSE 5000

# start-period はワーカーごとの起動時ウォームアップ (ダミー画像の合成) を考慮
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

CMD ["gunicorn", "src.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "2", \
     "-b", "0.0.0.0:5000", \
     "--timeout", "300"]
