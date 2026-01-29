"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
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
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);

  // プレビュー用の回転角度（スライダー操作中にリアルタイム表示）
  const [previewRotation, setPreviewRotation] = useState<number>(0);
  // 確定した回転角度（画像生成済み）
  const [appliedRotation, setAppliedRotation] = useState<number>(0);
  // 回転済み画像のURL
  const [rotatedImageUrl, setRotatedImageUrl] = useState<string>(src);
  // 画像生成中フラグ
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  // グリッド表示フラグ
  const [showGrid, setShowGrid] = useState<boolean>(true);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      imgRef.current = e.currentTarget;
    },
    [],
  );

  // 画像を回転させる関数
  const rotateImage = useCallback(
    async (imageSrc: string, degrees: number): Promise<string> => {
      return new Promise((resolve, reject) => {
        const image = new window.Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("Canvas context not available"));
            return;
          }

          const radians = (degrees * Math.PI) / 180;

          // 回転後のキャンバスサイズを計算
          const sin = Math.abs(Math.sin(radians));
          const cos = Math.abs(Math.cos(radians));
          const newWidth = image.width * cos + image.height * sin;
          const newHeight = image.width * sin + image.height * cos;

          canvas.width = newWidth;
          canvas.height = newHeight;

          // キャンバスの中心に移動して回転
          ctx.translate(newWidth / 2, newHeight / 2);
          ctx.rotate(radians);
          ctx.drawImage(image, -image.width / 2, -image.height / 2);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Canvas is empty"));
                return;
              }
              const url = URL.createObjectURL(blob);
              resolve(url);
            },
            "image/jpeg",
            0.95,
          );
        };
        image.onerror = () => reject(new Error("Failed to load image"));
        image.src = imageSrc;
      });
    },
    [],
  );

  // 回転を適用する（スライダーを離したとき）
  const applyRotation = useCallback(async () => {
    if (previewRotation === appliedRotation) return;

    setIsGenerating(true);
    try {
      if (previewRotation === 0) {
        if (rotatedImageUrl !== src) {
          URL.revokeObjectURL(rotatedImageUrl);
        }
        setRotatedImageUrl(src);
      } else {
        const rotatedUrl = await rotateImage(src, previewRotation);
        if (rotatedImageUrl !== src) {
          URL.revokeObjectURL(rotatedImageUrl);
        }
        setRotatedImageUrl(rotatedUrl);
      }
      setAppliedRotation(previewRotation);
      // クロップ領域をリセット
      setCrop({
        unit: "%",
        width: 30,
        height: 30,
        x: 0,
        y: 0,
      });
    } catch (error) {
      console.error("Failed to rotate image:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [previewRotation, appliedRotation, rotatedImageUrl, src, rotateImage]);

  const onCropComplete = async () => {
    if (imgRef.current && crop.width && crop.height) {
      const croppedUrl = await getCroppedImg(imgRef.current, crop);
      setCroppedImageUrl(croppedUrl);
    }
  };

  const getCroppedImg = (
    image: HTMLImageElement,
    cropData: Crop,
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
    const cropX =
      cropData.unit === "%" ? (cropData.x / 100) * image.width : cropData.x;
    const cropY =
      cropData.unit === "%" ? (cropData.y / 100) * image.height : cropData.y;
    const cropWidth =
      cropData.unit === "%"
        ? (cropData.width / 100) * image.width
        : cropData.width;
    const cropHeight =
      cropData.unit === "%"
        ? (cropData.height / 100) * image.height
        : cropData.height;

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
      cropHeight * scaleY,
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
        1,
      );
    });
  };

  const handleRotate90 = async (direction: "left" | "right") => {
    const newRotation = (() => {
      const delta = direction === "left" ? -90 : 90;
      const result = previewRotation + delta;
      if (result > 180) return result - 360;
      if (result < -180) return result + 360;
      return result;
    })();

    setPreviewRotation(newRotation);

    // 90度ボタンは即座に適用
    setIsGenerating(true);
    try {
      if (newRotation === 0) {
        if (rotatedImageUrl !== src) {
          URL.revokeObjectURL(rotatedImageUrl);
        }
        setRotatedImageUrl(src);
      } else {
        const rotatedUrl = await rotateImage(src, newRotation);
        if (rotatedImageUrl !== src) {
          URL.revokeObjectURL(rotatedImageUrl);
        }
        setRotatedImageUrl(rotatedUrl);
      }
      setAppliedRotation(newRotation);
      setCrop({
        unit: "%",
        width: 30,
        height: 30,
        x: 0,
        y: 0,
      });
    } catch (error) {
      console.error("Failed to rotate image:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetRotation = async () => {
    setPreviewRotation(0);
    if (rotatedImageUrl !== src) {
      URL.revokeObjectURL(rotatedImageUrl);
    }
    setRotatedImageUrl(src);
    setAppliedRotation(0);
    setCrop({
      unit: "%",
      width: 30,
      height: 30,
      x: 0,
      y: 0,
    });
  };

  // CSSプレビュー用の差分角度を計算
  const cssRotationDiff = previewRotation - appliedRotation;

  return (
    <div className="text-center min-h-screen">
      <Topbar />
      <div className="flex justify-center items-start p-8 bg-[#2a2a2a] shadow-lg rounded-lg m-5 text-[#f0f0f0]">
        <div className="flex gap-5 w-full">
          <div className="flex-1 flex flex-col justify-center items-center shadow-lg border-2 border-[#333] p-5 bg-[#2a2a2a] rounded-lg">
            <h2 className="text-lg font-bold mb-4">
              4. 画像を調整してトリミング領域を選択
              <br />
              <span className="text-sm font-normal">
                [ ドラッグで範囲を選択 ]
              </span>
            </h2>

            {/* 回転コントロール */}
            <div className="w-full mb-4 px-4">
              <div className="flex items-center justify-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => handleRotate90("left")}
                  disabled={isGenerating}
                  className="px-3 py-2 bg-[#444] text-[#f0f0f0] rounded-lg hover:bg-[#555] transition-all border border-[#333] disabled:opacity-50"
                >
                  ◀ -90°
                </button>
                <span className="text-sm min-w-[80px]">
                  回転: {previewRotation}°
                </span>
                <button
                  type="button"
                  onClick={() => handleRotate90("right")}
                  disabled={isGenerating}
                  className="px-3 py-2 bg-[#444] text-[#f0f0f0] rounded-lg hover:bg-[#555] transition-all border border-[#333] disabled:opacity-50"
                >
                  +90° ▶
                </button>
                {previewRotation !== 0 && (
                  <button
                    type="button"
                    onClick={handleResetRotation}
                    disabled={isGenerating}
                    className="px-3 py-2 bg-[#555] text-[#f0f0f0] rounded-lg hover:bg-[#666] transition-all border border-[#333] text-sm disabled:opacity-50"
                  >
                    リセット
                  </button>
                )}
              </div>
              <input
                type="range"
                value={previewRotation}
                min={-180}
                max={180}
                step={0.1}
                onChange={(e) => setPreviewRotation(Number(e.target.value))}
                onPointerUp={applyRotation}
                onTouchEnd={applyRotation}
                className="w-full h-2 bg-[#444] rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-[#888] mt-1">
                <span>-180°</span>
                <span>0°</span>
                <span>180°</span>
              </div>
            </div>

            {/* グリッド表示切り替え */}
            <div className="mb-4">
              <label className="flex items-center justify-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="w-4 h-4 accent-[#4ade80]"
                />
                <span className="text-sm">ガイド線を表示</span>
              </label>
            </div>

            {/* 画像プレビュー・クロップエリア */}
            <div className="relative">
              {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20 rounded-lg">
                  <span className="text-white">処理中...</span>
                </div>
              )}
              {/* グリッドオーバーレイ（回転しない） */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(255, 255, 255, 0.3) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255, 255, 255, 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: "10% 10%",
                  }}
                />
              )}
              {rotatedImageUrl && (
                <div
                  style={{
                    transform:
                      cssRotationDiff !== 0
                        ? `rotate(${cssRotationDiff}deg)`
                        : undefined,
                    transition: "transform 0.05s ease-out",
                  }}
                >
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    ruleOfThirds
                    className="max-w-[60%]"
                  >
                    <img
                      src={rotatedImageUrl}
                      alt="Crop target"
                      onLoad={onImageLoad}
                      style={{ maxWidth: "100%" }}
                    />
                  </ReactCrop>
                </div>
              )}
            </div>
            <button
              type="button"
              className="inline-block rounded-lg text-base text-center cursor-pointer py-3 px-3 bg-[#444] text-[#f0f0f0] transition-all duration-300 shadow border-2 border-[#333] mt-4 hover:shadow-none hover:bg-[#555] hover:text-white disabled:opacity-50"
              onClick={onCropComplete}
              disabled={isGenerating || cssRotationDiff !== 0}
            >
              画像を切り取る
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center shadow-lg border-2 border-[#333] p-5 bg-[#2a2a2a] rounded-lg">
            <h2 className="text-lg font-bold mb-4">
              5. 完成イメージはこちらに表示されます
            </h2>
            {croppedImageUrl ? (
              <img
                alt="Crop"
                className="max-w-[75%] border border-[#ccc] shadow rounded-lg"
                src={croppedImageUrl}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-[#888] py-8">
                <Image
                  src="/cropPlaceholder.svg"
                  alt="placeholder"
                  width={120}
                  height={120}
                  className="mb-4 opacity-60"
                />
                <p className="text-sm">左の画像で領域を選択し</p>
                <p className="text-sm">
                  「画像を切り取る」ボタンを押してください
                </p>
              </div>
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
