"""gunicorn の設定。Dockerfile の CMD から `gunicorn -c gunicorn.conf.py src.main:app` で読む。"""

from src.infra.logging_config import LogSettings, build_logging_dict

bind = "0.0.0.0:5000"
worker_class = "uvicorn.workers.UvicornWorker"
# ワーカーは 1 本。合成結果のプロセス内メモリキャッシュ (ダウンロード用) は
# ワーカー間で共有されないため、複数ワーカーだと download が別ワーカーに当たって
# 取り出せなくなる。同時リクエストは uvicorn worker のスレッドプールで捌く。
workers = 1
timeout = 300

# gunicorn 自身のログもアプリと同じ構造化ログにする。
# アクセスログは接続元 IP を含み、アプリの request.completed で代替するため出さない
accesslog = None
logconfig_dict = build_logging_dict(LogSettings.from_env())
