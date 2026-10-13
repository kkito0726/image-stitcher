"use client";

import type { StitchMode } from "@/lib/stitchApi";
import { StepHeader } from "../StepHeader";
import { CropIcon, StitchIcon } from "../icons";

const MODE_OPTIONS: ReadonlyArray<{ value: StitchMode; label: string; description: string }> = [
  { value: "Scans", label: "スキャンモード", description: "顕微鏡写真など奥行きなし（アフィン投影）" },
  { value: "Panorama", label: "パノラマモード", description: "風景写真など奥行きあり（球面投影）" },
];

interface ModeSelectorProps {
  mode: StitchMode;
  isProcessing: boolean;
  onModeChange: (mode: StitchMode) => void;
}

/** Step 2: 合成モードの選択 */
export const ModeSelector = ({ mode, isProcessing, onModeChange }: ModeSelectorProps) => (
  <section className="glass-card-elevated shrink-0 p-5 sm:p-6 fade-in desk:p-4">
    <StepHeader
      step={2}
      title="合成モードを選択"
      description="撮影した画像の種類に合わせて選択"
      descriptionClassName="desk:hidden"
      className="desk:mb-3"
    />

    <fieldset className="grid gap-2 desk:grid-cols-2" disabled={isProcessing}>
      <legend className="sr-only">合成モード</legend>
      {MODE_OPTIONS.map((option) => (
        <label key={option.value} className="mode-card">
          <input
            type="radio"
            name="mode"
            value={option.value}
            checked={mode === option.value}
            onChange={() => onModeChange(option.value)}
            className="sr-only"
          />
          <span className="mode-card-radio" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[var(--text-primary)]">{option.label}</span>
            <span className="block text-xs leading-relaxed text-[var(--text-secondary)]">{option.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  </section>
);

/** 1枚だけ読み込んだ場合は合成せずトリミングのみ */
export const SingleImageNotice = () => (
  <section className="glass-card-elevated shrink-0 p-5 sm:p-6 fade-in desk:p-4">
    <StepHeader step={2} title="トリミング" description="画像を編集できます" className="desk:mb-3" />
    <div className="info-box">
      <p>1枚の画像が選択されています。トリミング画面で回転や切り取りができます。</p>
    </div>
  </section>
);

interface StitchActionsProps {
  imageCount: number;
  selectedIndex: number;
  isProcessing: boolean;
  onStitch: () => void;
  onCropOnly: () => void;
}

/** 実行ボタン群。desk 幅では操作パネルの下端に固定し、常に画面内に表示する */
export const StitchActions = ({ imageCount, selectedIndex, isProcessing, onStitch, onCropOnly }: StitchActionsProps) => (
  <div className="glass-card-elevated grid shrink-0 gap-2.5 p-4 fade-in">
    {imageCount === 1 ? (
      <button type="button" onClick={onCropOnly} className="btn-primary w-full py-3.5 text-base">
        <CropIcon size={20} />
        トリミングへ進む
      </button>
    ) : (
      <>
        <button type="button" onClick={onStitch} disabled={isProcessing} className="btn-primary w-full py-3.5 text-base">
          {isProcessing ? (
            <>
              <span className="pulse-dot" />
              処理中...
            </>
          ) : (
            <>
              <StitchIcon size={20} />
              画像を合成する
            </>
          )}
        </button>
        <button type="button" onClick={onCropOnly} disabled={isProcessing} className="btn-secondary w-full py-2.5">
          <CropIcon />
          トリミングのみ（{selectedIndex + 1}枚目）
        </button>
      </>
    )}
  </div>
);
