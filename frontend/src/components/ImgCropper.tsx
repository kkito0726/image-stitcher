"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import ReactCrop, { type Crop } from "react-image-crop";
import { Topbar } from "./Topbar";

interface ImgCropperProps {
  src: string;
}

export const ImgCropper = ({ src }: ImgCropperProps) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    width: 30,
    height: 30,
    x: 0,
    y: 0,
  });
  const [croppedImageUrl, setCroppedImageUrl] = useState<string>("/initImg.png");

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
  }, []);

  const onCropComplete = async () => {
    if (imgRef.current && crop.width && crop.height) {
      const croppedUrl = await getCroppedImg(imgRef.current, crop);
      setCroppedImageUrl(croppedUrl);
    }
  };

  const getCroppedImg = (
    image: HTMLImageElement,
    cropData: Crop
  ): Promise<string> => {
    const canvas = document.createElement("canvas");
    const pixelRatio = window.devicePixelRatio;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return Promise.reject(new Error("Canvas context not available"));
    }

    // crop値がパーセントの場合はピクセルに変換
    const cropX = cropData.unit === "%" ? (cropData.x / 100) * image.width : cropData.x;
    const cropY = cropData.unit === "%" ? (cropData.y / 100) * image.height : cropData.y;
    const cropWidth = cropData.unit === "%" ? (cropData.width / 100) * image.width : cropData.width;
    const cropHeight = cropData.unit === "%" ? (cropData.height / 100) * image.height : cropData.height;

    canvas.width = cropWidth * pixelRatio * scaleX;
    canvas.height = cropHeight * pixelRatio * scaleY;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      image,
      cropX * scaleX,
      cropY * scaleY,
      cropWidth * scaleX,
      cropHeight * scaleY,
      0,
      0,
      cropWidth * scaleX,
      cropHeight * scaleY
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            console.error("Canvas is empty");
            return;
          }
          const fileUrl = window.URL.createObjectURL(blob);
          resolve(fileUrl);
        },
        "image/jpeg",
        1
      );
    });
  };

  return (
    <div className="text-center min-h-screen">
      <Topbar />
      <div className="flex justify-center items-start p-8 bg-[#2a2a2a] shadow-lg rounded-lg m-5 text-[#f0f0f0]">
        <div className="flex gap-5 w-full">
          <div className="flex-1 flex flex-col justify-center items-center shadow-lg border-2 border-[#333] p-5 bg-[#2a2a2a] rounded-lg">
            <h2 className="text-lg font-bold mb-4">
              4. 必要な領域をドラッグで選択する
              <br />
              <span className="text-sm font-normal">[ 何度でも選択可能 ]</span>
            </h2>
            {src && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                ruleOfThirds
                className="max-w-[60%]"
              >
                <img
                  src={src}
                  alt="Crop target"
                  onLoad={onImageLoad}
                  style={{ maxWidth: "100%" }}
                />
              </ReactCrop>
            )}
            <button
              type="button"
              className="inline-block rounded-lg text-base text-center cursor-pointer py-3 px-3 bg-[#444] text-[#f0f0f0] transition-all duration-300 shadow border-2 border-[#333] mt-4 hover:shadow-none hover:bg-[#555] hover:text-white"
              onClick={onCropComplete}
            >
              画像を切り取る
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center shadow-lg border-2 border-[#333] p-5 bg-[#2a2a2a] rounded-lg">
            <h2 className="text-lg font-bold mb-4">
              5. 完成イメージはこちらに表示されます
            </h2>
            {croppedImageUrl && (
              <img
                alt="Crop"
                className="max-w-[75%] border border-[#ccc] shadow rounded-lg"
                src={croppedImageUrl}
              />
            )}
          </div>
        </div>
      </div>

      <Link
        href="/"
        className="inline-block rounded-lg text-base text-center cursor-pointer py-3 px-3 bg-[#444] text-[#f0f0f0] transition-all duration-300 shadow border-2 border-[#333] mt-4 hover:shadow-none hover:bg-[#555] hover:text-white no-underline"
      >
        トップページに戻る
      </Link>
    </div>
  );
};
