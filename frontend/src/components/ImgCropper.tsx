"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import type { Crop } from "react-image-crop";
import { getCroppedImg, rotateImage } from "@/lib/canvasImage";
import { AppShell } from "./AppShell";
import { ChevronLeftIcon } from "./icons";
import { CropCanvas } from "./crop/CropCanvas";
import { RotationPanel } from "./crop/RotationPanel";
import { CropPreviewPanel } from "./crop/CropPreviewPanel";

interface ImgCropperProps {
  src: string;
}

const INITIAL_CROP: Crop = {
  unit: "%",
  width: 30,
  height: 30,
  x: 0,
  y: 0,
};

const normalizeRotation = (degrees: number) => {
  if (degrees > 180) return degrees - 360;
  if (degrees < -180) return degrees + 360;
  return degrees;
};

export const ImgCropper = ({ src }: ImgCropperProps) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>(INITIAL_CROP);
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

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
  }, []);

  // 指定角度の回転画像を生成して差し替える（0度なら元画像に戻す）
  const commitRotation = useCallback(
    async (degrees: number) => {
      setIsGenerating(true);
      try {
        const nextUrl = degrees === 0 ? src : await rotateImage(src, degrees);
        if (rotatedImageUrl !== src) {
          URL.revokeObjectURL(rotatedImageUrl);
        }
        setRotatedImageUrl(nextUrl);
        setAppliedRotation(degrees);
        // クロップ領域をリセット
        setCrop(INITIAL_CROP);
      } catch (error) {
        console.error("Failed to rotate image:", error);
      } finally {
        setIsGenerating(false);
      }
    },
    [rotatedImageUrl, src]
  );

  // 回転を適用する（スライダーを離したとき）
  const applyRotation = useCallback(async () => {
    if (previewRotation === appliedRotation) return;
    await commitRotation(previewRotation);
  }, [previewRotation, appliedRotation, commitRotation]);

  // 90度ボタンは即座に適用
  const handleRotate90 = async (direction: "left" | "right") => {
    const newRotation = normalizeRotation(previewRotation + (direction === "left" ? -90 : 90));
    setPreviewRotation(newRotation);
    await commitRotation(newRotation);
  };

  const handleResetRotation = () => {
    setPreviewRotation(0);
    if (rotatedImageUrl !== src) {
      URL.revokeObjectURL(rotatedImageUrl);
    }
    setRotatedImageUrl(src);
    setAppliedRotation(0);
    setCrop(INITIAL_CROP);
  };

  const onCropComplete = async () => {
    if (imgRef.current && crop.width && crop.height) {
      const croppedUrl = await getCroppedImg(imgRef.current, crop);
      setCroppedImageUrl(croppedUrl);
    }
  };

  // CSSプレビュー用の差分角度を計算
  const cssRotationDiff = previewRotation - appliedRotation;

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-3xl desk:max-w-[1600px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 desk:min-h-0 desk:py-4">
        {/* Page Header */}
        <header className="flex items-center gap-3 fade-in">
          <Link
            href="/"
            className="btn-ghost shrink-0 border-[var(--border-subtle)] px-3"
            aria-label="トップページに戻る"
          >
            <ChevronLeftIcon size={16} />
            戻る
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">画像を調整</h1>
            <p className="hidden text-sm text-[var(--text-secondary)] sm:block">
              回転やトリミングで仕上げを調整できます
            </p>
          </div>
        </header>

        {/* 左: 編集エリア / 右: ツールとプレビュー */}
        <div className="grid grid-cols-1 gap-4 desk:min-h-0 desk:flex-1 desk:grid-cols-[minmax(0,1fr)_clamp(300px,28vw,400px)] desk:gap-5">
          <CropCanvas
            imageUrl={rotatedImageUrl}
            crop={crop}
            cssRotationDiff={cssRotationDiff}
            isGenerating={isGenerating}
            showGrid={showGrid}
            onShowGridChange={setShowGrid}
            onCropChange={setCrop}
            onImageLoad={onImageLoad}
          />

          <aside className="panel-scroll relative flex flex-col gap-4 desk:-mr-2 desk:min-h-0 desk:overflow-y-auto desk:pr-2">
            <RotationPanel
              previewRotation={previewRotation}
              isGenerating={isGenerating}
              cropDisabled={isGenerating || cssRotationDiff !== 0}
              onRotate90={handleRotate90}
              onReset={handleResetRotation}
              onPreviewChange={setPreviewRotation}
              onApply={applyRotation}
              onCrop={onCropComplete}
            />
            <CropPreviewPanel croppedImageUrl={croppedImageUrl} />
          </aside>
        </div>
      </main>
    </AppShell>
  );
};
