"use client";

import { useRef, type CSSProperties, type SyntheticEvent } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import { useElementHeight } from "@/hooks/useElementHeight";
import { StepHeader } from "../StepHeader";

interface CropCanvasProps {
  imageUrl: string;
  crop: Crop;
  cssRotationDiff: number;
  isGenerating: boolean;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  onCropChange: (crop: Crop) => void;
  onImageLoad: (e: SyntheticEvent<HTMLImageElement>) => void;
}

// 画像の周囲の余白（p-4 の上下分）
const CANVAS_PADDING_PX = 32;

const CROP_IMAGE_STYLE: CSSProperties = { maxWidth: "100%", maxHeight: "var(--crop-img-max-h)" };

const GRID_OVERLAY_STYLE: CSSProperties = {
  backgroundImage: `
    linear-gradient(to right, rgba(255, 255, 255, 0.5) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.5) 1px, transparent 1px)
  `,
  backgroundSize: "10% 10%",
};

export const CropCanvas = ({
  imageUrl,
  crop,
  cssRotationDiff,
  isGenerating,
  showGrid,
  onShowGridChange,
  onCropChange,
  onImageLoad,
}: CropCanvasProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasHeight = useElementHeight(canvasRef);
  // desk 幅では作業面の高さに画像を収める（globals.css の .crop-canvas 参照）
  const canvasStyle = (
    canvasHeight ? { "--crop-max-h": `${Math.max(canvasHeight - CANVAS_PADDING_PX, 120)}px` } : {}
  ) as CSSProperties;

  return (
    <section className="glass-card-elevated flex flex-col p-3 sm:p-5 fade-in desk:min-h-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 sm:mb-4">
        <StepHeader step={4} title="編集エリア" description="ドラッグで範囲を選択" className="mb-0" />
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => onShowGridChange(e.target.checked)}
            className="checkbox-modern"
          />
          <span className="text-sm text-[var(--text-secondary)]">ガイド線を表示</span>
        </label>
      </div>

      <div
        ref={canvasRef}
        style={canvasStyle}
        className="stage-canvas crop-canvas overflow-hidden desk:min-h-0 desk:flex-1"
      >
        {isGenerating && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
              <span className="text-sm text-[var(--text-primary)]">処理中...</span>
            </div>
          </div>
        )}

        {/* Grid Overlay */}
        {showGrid && <div className="pointer-events-none absolute inset-0 z-10" style={GRID_OVERLAY_STYLE} />}

        <div
          className="flex items-center justify-center p-4 desk:absolute desk:inset-0"
          style={{
            transform: cssRotationDiff !== 0 ? `rotate(${cssRotationDiff}deg)` : undefined,
            transition: "transform 0.05s ease-out",
          }}
        >
          {/* ％指定で保持し、作業面のリサイズ時も選択範囲が画像に追従するようにする */}
          <ReactCrop crop={crop} onChange={(_, percentCrop) => onCropChange(percentCrop)} ruleOfThirds className="max-w-full">
            <img src={imageUrl} alt="Crop target" onLoad={onImageLoad} style={CROP_IMAGE_STYLE} />
          </ReactCrop>
        </div>
      </div>
    </section>
  );
};
