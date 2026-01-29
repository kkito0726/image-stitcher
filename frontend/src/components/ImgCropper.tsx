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
    []
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
            0.95
          );
        };
        image.onerror = () => reject(new Error("Failed to load image"));
        image.src = imageSrc;
      });
    },
    []
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
    <div className="min-h-screen bg-[var(--bg-void)]">
      <Topbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6 fade-in">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-colors mb-4"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            戻る
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            画像を調整
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            回転やトリミングで仕上げを調整できます
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Editor */}
          <div className="glass-card-elevated p-6 fade-in">
            <div className="section-title">
              <span className="step-badge">4</span>
              <div>
                <h2>編集エリア</h2>
                <p>ドラッグで範囲を選択</p>
              </div>
            </div>

            {/* Rotation Controls */}
            <div className="mb-6">
              {/* Quick Rotation Buttons */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => handleRotate90("left")}
                  disabled={isGenerating}
                  className="btn-secondary py-2 px-4"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38" />
                  </svg>
                  -90°
                </button>

                <div className="px-4 py-2 bg-[var(--bg-glass)] border border-[var(--border-subtle)] rounded-lg min-w-[80px] text-center">
                  <span className="text-[var(--accent-primary)] font-medium">
                    {previewRotation}°
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRotate90("right")}
                  disabled={isGenerating}
                  className="btn-secondary py-2 px-4"
                >
                  +90°
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
                  </svg>
                </button>

                {previewRotation !== 0 && (
                  <button
                    type="button"
                    onClick={handleResetRotation}
                    disabled={isGenerating}
                    className="btn-ghost"
                  >
                    リセット
                  </button>
                )}
              </div>

              {/* Fine Rotation Slider */}
              <div className="px-2">
                <input
                  type="range"
                  value={previewRotation}
                  min={-180}
                  max={180}
                  step={0.1}
                  onChange={(e) => setPreviewRotation(Number(e.target.value))}
                  onPointerUp={applyRotation}
                  onTouchEnd={applyRotation}
                  className="slider-modern w-full"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1 px-1">
                  <span>-180°</span>
                  <span>0°</span>
                  <span>180°</span>
                </div>
              </div>
            </div>

            {/* Grid Toggle */}
            <div className="flex items-center justify-center mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="checkbox-modern"
                />
                <span className="text-sm text-[var(--text-secondary)]">
                  ガイド線を表示
                </span>
              </label>
            </div>

            {/* Image Editor Area */}
            <div className="relative rounded-lg overflow-hidden bg-zinc-800 border border-[var(--border-subtle)]">
              {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[var(--text-primary)] text-sm">
                      処理中...
                    </span>
                  </div>
                </div>
              )}

              {/* Grid Overlay */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(255, 255, 255, 0.5) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255, 255, 255, 0.5) 1px, transparent 1px)
                    `,
                    backgroundSize: "10% 10%",
                  }}
                />
              )}

              {rotatedImageUrl && (
                <div
                  className="flex items-center justify-center p-4"
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
                    className="max-w-full"
                  >
                    <img
                      src={rotatedImageUrl}
                      alt="Crop target"
                      onLoad={onImageLoad}
                      style={{ maxWidth: "100%", maxHeight: "50vh" }}
                    />
                  </ReactCrop>
                </div>
              )}
            </div>

            {/* Crop Button */}
            <div className="mt-6 text-center">
              <button
                type="button"
                className="btn-primary"
                onClick={onCropComplete}
                disabled={isGenerating || cssRotationDiff !== 0}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2L6 6L2 6" />
                  <path d="M6 6L12 12" />
                  <path d="M18 22L18 18L22 18" />
                  <path d="M18 18L12 12" />
                  <rect x="8" y="8" width="8" height="8" rx="1" />
                </svg>
                選択範囲を切り取る
              </button>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="glass-card-elevated p-6 fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="section-title">
              <span className={`step-badge ${!croppedImageUrl ? "step-badge-inactive" : ""}`}>
                5
              </span>
              <div>
                <h2>プレビュー</h2>
                <p>切り取り後の画像がここに表示されます</p>
              </div>
            </div>

            {croppedImageUrl ? (
              <div className="scale-in">
                {/* Preview Image */}
                <div className="result-image-container mb-6">
                  <img
                    alt="Cropped result"
                    src={croppedImageUrl}
                    className="result-image w-full"
                  />
                </div>

                {/* Download Button */}
                <div className="text-center">
                  <a
                    href={croppedImageUrl}
                    download="cropped-image.jpg"
                    className="btn-primary"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    画像をダウンロード
                  </a>
                </div>
              </div>
            ) : (
              <div className="placeholder min-h-[300px] border border-dashed border-[var(--border-subtle)] rounded-lg">
                <svg
                  viewBox="0 0 80 80"
                  fill="none"
                  className="placeholder-icon"
                >
                  <rect
                    x="10"
                    y="15"
                    width="60"
                    height="50"
                    rx="4"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-[var(--text-muted)]"
                  />
                  <path
                    d="M10 50L25 35L40 50L55 35L70 50"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[var(--text-muted)]"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-[var(--text-muted)]"
                  />
                </svg>
                <div className="placeholder-text">
                  <p>左の画像で範囲を選択し</p>
                  <p>「選択範囲を切り取る」ボタンを押してください</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-8 text-center fade-in" style={{ animationDelay: "0.2s" }}>
          <Link href="/" className="btn-ghost">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            トップページに戻る
          </Link>
        </div>
      </main>
    </div>
  );
};
