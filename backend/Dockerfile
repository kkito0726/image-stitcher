FROM python:3.12

WORKDIR /usr/src/server

COPY . .

RUN apt-get update && apt-get install -y libgl1 \
 && pip install --upgrade pip \
 && pip install "numpy<2" && pip install -r requirements.txt

 CMD [ "python", "server.py"]
