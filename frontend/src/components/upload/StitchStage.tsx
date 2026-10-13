"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { DownloadFormat, StitchState } from "@/lib/stitchApi";
import { isDeskLayout } from "@/lib/breakpoints";
import { AlertCircleIcon, CropIcon, DownloadIcon, ErrorCircleIcon } from "../icons";
import { StageHero } from "./StageHero";

interface StitchStageProps {
  state: StitchState;
  imageCount: number;
  selectedIndex: number;
  selectedSrc: string | undefined;
  isDownloading: boolean;
  downloadError: string | null;
  onCrop: () => void;
  onDownload: (format: DownloadFormat) => void;
}

/** ステージ内で画像を表示する。desk 幅では作業面いっぱいに object-contain で収める */
const StageImage = ({ src, alt, dimmed = false }: { src: string; alt: string; dimmed?: boolean }) => (
  <div className="flex items-center justify-center desk:absolute desk:inset-5">
    <img
      src={src}
      alt={alt}
      className={`stage-image max-h-[65dvh] w-auto max-w-full object-contain transition-opacity desk:h-full desk:max-h-none desk:w-full desk:rounded-none desk:shadow-none ${
        dimmed ? "opacity-30" : ""
      }`}
    />
  </div>
);

const StageMessage = ({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) => (
  <div className="flex items-center justify-center p-4 desk:absolute desk:inset-0">
    <div className="w-full max-w-md text-center scale-in">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        {icon}
      </div>
      <h2 className="mb-2 text-lg text-red-400">{title}</h2>
      {children}
    </div>
  </div>
);

const ProcessingOverlay = () => (
  <div className="absolute inset-0 z-10 flex items-center justify-center fade-in">
    <div className="glass-card-elevated flex flex-col items-center gap-4 px-8 py-6">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--border-subtle)]" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
      <div className="text-center">
        <p className="mb-1 font-medium text-[var(--text-primary)]">画像を合成しています</p>
        <p className="text-sm text-[var(--text-muted)]">しばらくお待ちください...</p>
      </div>
      <div className="progress-bar w-48">
        <div className="progress-bar-fill w-full" />
      </div>
    </div>
  </div>
);

const STAGE_LABELS: Record<StitchState["phase"], string> = {
  idle: "Preview",
  processing: "Stitching",
  success: "Result",
  failed: "Failed",
  error: "Error",
};

export const StitchStage = ({
  state,
  imageCount,
  selectedIndex,
  selectedSrc,
  isDownloading,
  downloadError,
  onCrop,
  onDownload,
}: StitchStageProps) => {
  const stageRef = useRef<HTMLElement>(null);
  const { phase } = state;

  // モバイルでは結果がパネルの下に出るため、状態が変わったらステージまでスクロールする
  useEffect(() => {
    if (phase !== "idle" && !isDeskLayout()) {
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  const hasImages = imageCount > 0;
  const caption = (() => {
    if (phase === "success") return "合成結果（プレビュー用の縮小版）";
    if (hasImages) return `${selectedIndex + 1} / ${imageCount} 枚目`;
    return "No image";
  })();

  return (
    <section
      ref={stageRef}
      // モバイルでは何も表示するものがない間はステージ自体を隠す
      className={`glass-card-elevated scroll-mt-20 flex-col gap-3 p-3 sm:p-4 desk:flex desk:min-h-0 ${
        phase === "idle" ? "hidden" : "flex scale-in"
      }`}
      aria-live="polite"
    >
      <header className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              phase === "success" ? "bg-[var(--success)]" : "bg-[var(--accent-primary)]"
            } ${phase === "processing" ? "animate-pulse" : ""}`}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            {STAGE_LABELS[phase]}
          </span>
        </div>
        <span className="truncate text-xs text-[var(--text-muted)]">{caption}</span>
      </header>

      <div className="stage-canvas p-3 sm:p-4 desk:min-h-0 desk:flex-1 desk:p-0">
        {phase === "success" && <StageImage src={state.previewUrl} alt="stitched" />}

        {(phase === "idle" || phase === "processing") && selectedSrc && (
          <StageImage src={selectedSrc} alt={`selected-${selectedIndex + 1}`} dimmed={phase === "processing"} />
        )}

        {phase === "processing" && <ProcessingOverlay />}

        {phase === "idle" && !selectedSrc && (
          <div className="desk:absolute desk:inset-0 desk:overflow-y-auto">
            <StageHero />
          </div>
        )}

        {phase === "failed" && (
          <StageMessage icon={<ErrorCircleIcon size={22} />} title="合成できませんでした">
            <div className="status-error text-left">
              <h3 className="mb-2 font-medium text-[var(--text-primary)]">パノラマ合成のコツ</h3>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                特徴点同士を合わせられず、エラーになりました。
                <br />
                画像の重なり合う部分（のりしろ）を増やして撮影し直してみてください。
                目安として、隣り合う画像の30%以上が重なるようにすると成功率が上がります。
              </p>
            </div>
          </StageMessage>
        )}

        {phase === "error" && (
          <StageMessage icon={<AlertCircleIcon size={22} />} title="エラーが発生しました">
            <p className="text-sm text-[var(--text-secondary)]">{state.message}</p>
          </StageMessage>
        )}
      </div>

      {phase === "success" && (
        <footer className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            フル解像度は「ダウンロード」から取得できます。
            <button
              type="button"
              onClick={() => onDownload("png")}
              disabled={isDownloading}
              className="ml-1 underline hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              無劣化の PNG でダウンロード (ファイルサイズ大)
            </button>
            {downloadError && <span className="mt-1 block text-sm text-red-400">{downloadError}</span>}
          </p>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={onCrop} className="btn-primary px-3 sm:px-6">
              <CropIcon />
              トリミングする
            </button>
            <button
              type="button"
              onClick={() => onDownload("jpeg")}
              disabled={isDownloading}
              className="btn-secondary px-3 sm:px-6"
            >
              {isDownloading ? (
                <>
                  <span className="pulse-dot" />
                  ダウンロード中...
                </>
              ) : (
                <>
                  <DownloadIcon />
                  ダウンロード<span className="hidden sm:inline"> (JPEG)</span>
                </>
              )}
            </button>
          </div>
        </footer>
      )}
    </section>
  );
};
