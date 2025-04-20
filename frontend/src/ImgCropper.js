import React from "react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import "./ImgCropper.css";

import InitImg from "./initImg.png";
import { Topbar } from "./Topbar";

export const ImgCropper = () => {
  const src = useLocation().state;
  const [imageRef, setImageRef] = useState(null);
  const [crop, setCrop] = useState({ unit: "%", width: 30 });
  const [croppedImageUrl, setcroppedImageUrl] = useState(InitImg);

  const onCropComplete = (crop) => {
    makeClientCrop(crop);
  };

  const makeClientCrop = async (crop) => {
    if (imageRef && crop.width && crop.height) {
      const croppedImageUrl = await getCroppedImg(
        imageRef,
        crop,
        "newFile.jpeg"
      );
      setcroppedImageUrl(croppedImageUrl);
    }
  };

  const getCroppedImg = (image, crop, fileName) => {
    const canvas = document.createElement("canvas");
    const pixelRatio = window.devicePixelRatio;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext("2d");

    canvas.width = crop.width * pixelRatio * scaleX;
    canvas.height = crop.height * pixelRatio * scaleY;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            //reject(new Error('Canvas is empty'));
            console.error("Canvas is empty");
            return;
          }
          blob.name = fileName;

          const fileUrl = window.URL.createObjectURL(blob);
          // window.URL.revokeObjectURL(fileUrl);
          resolve(fileUrl);
        },
        "image/jpeg",
        1
      );
    });
  };

  return (
    <div className="App">
      <Topbar />
      <div className="outerBox">
        <div className="imageEditor" style={{ display: "flex" }}>
          <div className="cropBox">
            <h2>
              4. 必要な領域をドラッグで選択する
              <br />[ 何度でも選択可能 ]
            </h2>
            {src && (
              <ReactCrop
                src={src}
                crop={crop}
                ruleOfThirds
                onImageLoaded={setImageRef}
                onChange={setCrop}
                style={{ width: "60%" }}
              />
            )}
            <button
              type="button"
              className="button"
              onClick={() => onCropComplete(crop)}
            >
              画像を切り取る
            </button>
          </div>
          <div className="cropBox">
            <h2>5. 完成イメージはこちらに表示されます</h2>
            {croppedImageUrl && (
              <img
                alt="Crop"
                style={{ width: "75%" }}
                src={croppedImageUrl}
                id="cropImg"
              />
            )}
          </div>
        </div>

        <Link to="/" className="button">
          トップページに戻る
        </Link>
      </div>
    </div>
  );
};
