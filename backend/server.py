import base64
import io

import cv2
import numpy as np
from flask import Flask, jsonify, make_response, request
from flask_cors import CORS

from stitch import stitch

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])


@app.route("/", methods=["GET"])
def index():
    return "Server!"


@app.route("/stitch", methods=["GET", "POST"])
def parse():
    if request.method == "POST":
        json = request.get_json()
        data = json["image"]
        mode = json["mode"]

        # 受け取ったBase64データをデコード
        read_img = []
        for i in range(len(data)):
            f = data[i]
            img_binary = base64.b64decode(f)

            bin_data = io.BytesIO(img_binary)
            file_bytes = np.asarray(bytearray(bin_data.read()), dtype=np.uint8)
            img = cv2.imdecode(file_bytes, 1)
            read_img.append(img)
        read_img = np.array(read_img)

        # 画像の重ね合わせ
        stitched, result = stitch(read_img, mode)

        # Base64へエンコード
        if result == 0:
            retval, buffer = cv2.imencode(".png", stitched)
            encoded_data = base64.b64encode(buffer).decode("utf-8")
        else:
            encoded_data = None
        res = {
            "base64Data": encoded_data,
            "isStitched": result,
        }

        return make_response(jsonify(res))


if __name__ == "__main__":
    app.debug = True
    app.run(host="0.0.0.0", port=5000)
