"use client";

import { CropIcon, RotateLeftIcon, RotateRightIcon } from "../icons";

interface RotationPanelProps {
  previewRotation: number;
  isGenerating: boolean;
  cropDisabled: boolean;
  onRotate90: (direction: "left" | "right") => void;
  onReset: () => void;
  onPreviewChange: (degrees: number) => void;
  onApply: () => void;
  onCrop: () => void;
}

export const RotationPanel = ({
  previewRotation,
  isGenerating,
  cropDisabled,
  onRotate90,
  onReset,
  onPreviewChange,
  onApply,
  onCrop,
}: RotationPanelProps) => (
  <section className="glass-card-elevated p-4 sm:p-5 fade-in" style={{ animationDelay: "0.05s" }}>
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">回転</h2>
      {previewRotation !== 0 && (
        <button type="button" onClick={onReset} disabled={isGenerating} className="btn-ghost px-2 py-1 text-xs">
          リセット
        </button>
      )}
    </div>

    {/* Quick Rotation Buttons */}
    <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <button type="button" onClick={() => onRotate90("left")} disabled={isGenerating} className="btn-secondary px-3 py-2">
        <RotateLeftIcon size={16} />
        -90°
      </button>
      <div className="min-w-[72px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-3 py-2 text-center">
        <span className="font-mono font-medium tabular-nums text-[var(--accent-primary)]">{previewRotation}°</span>
      </div>
      <button type="button" onClick={() => onRotate90("right")} disabled={isGenerating} className="btn-secondary px-3 py-2">
        +90°
        <RotateRightIcon size={16} />
      </button>
    </div>

    {/* Fine Rotation Slider */}
    <div className="px-1">
      <input
        type="range"
        aria-label="回転角度"
        value={previewRotation}
        min={-180}
        max={180}
        step={0.1}
        onChange={(e) => onPreviewChange(Number(e.target.value))}
        onPointerUp={onApply}
        onTouchEnd={onApply}
        className="slider-modern w-full"
      />
      <div className="mt-1 flex justify-between px-1 text-[10px] text-[var(--text-muted)]">
        <span>-180°</span>
        <span>0°</span>
        <span>180°</span>
      </div>
    </div>

    <button type="button" className="btn-primary mt-5 w-full" onClick={onCrop} disabled={cropDisabled}>
      <CropIcon />
      選択範囲を切り取る
    </button>
  </section>
);
