"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useImageContext } from "@/context/ImageContext";
import { useStitch } from "@/hooks/useStitch";
import { AppShell } from "./AppShell";
import { StepHeader } from "./StepHeader";
import { ResetIcon } from "./icons";
import { Dropzone } from "./upload/Dropzone";
import { ThumbnailGrid } from "./upload/ThumbnailGrid";
import { ModeSelector, SingleImageNotice, StitchActions } from "./upload/StitchControls";
import { StitchStage } from "./upload/StitchStage";

export const FileUploader = () => {
  const router = useRouter();
  const { setCropImageSrc } = useImageContext();
  const [path, setPath] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const stitch = useStitch();
  const hasImages = path.length > 0;

  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const selected = Array.from(fileList);
    // 差し替え時は前回の読み込み分と合成結果を破棄する
    path.forEach((url) => URL.revokeObjectURL(url));
    stitch.reset();
    setFiles(selected);
    setPath(selected.map((file) => window.URL.createObjectURL(file)));
    setSelectedIndex(0);
  };

  const navigateToCrop = (imageSrc: string) => {
    setCropImageSrc(imageSrc);
    router.push("/crop/");
  };

  const handleCropResult = () => {
    if (stitch.state.phase === "success") {
      // トリミングは表示用プレビュー(縮小版)に対して行う
      navigateToCrop(stitch.state.previewUrl);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto grid w-full max-w-3xl desk:max-w-[1600px] flex-1 grid-cols-1 content-start gap-4 px-4 py-5 sm:gap-5 sm:px-6 sm:py-8 desk:min-h-0 desk:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] desk:content-stretch desk:py-5">
        {/* 左: 操作パネル。desk 幅では実行ボタンを下端に固定し、上の領域だけを縮める/スクロールさせる */}
        <aside className="flex flex-col gap-4 sm:gap-5 desk:min-h-0 desk:gap-3">
          <div className="panel-scroll relative flex flex-col gap-4 sm:gap-5 desk:-mr-2 desk:min-h-0 desk:flex-1 desk:gap-3 desk:overflow-y-auto desk:pr-2">
            {/* モバイルではステージのイントロが出ないので簡易ヒーローを表示する */}
            <div className="fade-in desk:hidden">
              <h1 className="mb-1.5 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                Panorama Image <span className="text-[var(--accent-primary)]">Stitcher</span>
              </h1>
              <p className="text-sm text-[var(--text-secondary)] sm:text-base">
                複数の画像を自動で合成し、美しいパノラマ写真を作成します
              </p>
            </div>

            <section
              className="glass-card-elevated p-5 sm:p-6 fade-in desk:flex desk:min-h-60 desk:flex-col desk:p-4"
              style={{ animationDelay: "0.05s" }}
            >
              <div className="flex items-start justify-between gap-2">
                <StepHeader
                  step={1}
                  title="画像をアップロード"
                  description="JPEGまたはPNG形式の画像を選択してください"
                  descriptionClassName={hasImages ? "desk:hidden" : ""}
                  className="desk:mb-3"
                />
                {hasImages && (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="btn-ghost shrink-0 px-2 py-1 text-xs"
                    title="はじめからやり直す"
                  >
                    <ResetIcon size={14} />
                    やり直す
                  </button>
                )}
              </div>
              <Dropzone compact={hasImages} onFiles={processFiles} />
              {hasImages ? (
                <div className="mt-4 desk:flex desk:min-h-0 desk:flex-1 desk:flex-col">
                  <ThumbnailGrid path={path} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
                </div>
              ) : (
                <p className="mt-4 text-center text-xs text-[var(--text-muted)]">対応形式: JPEG, PNG / 複数選択可</p>
              )}
            </section>

            {path.length > 1 && (
              <ModeSelector
                mode={stitch.mode}
                isProcessing={stitch.state.phase === "processing"}
                onModeChange={stitch.setMode}
              />
            )}
            {path.length === 1 && <SingleImageNotice />}
          </div>

          {hasImages && (
            <StitchActions
              imageCount={path.length}
              selectedIndex={selectedIndex}
              isProcessing={stitch.state.phase === "processing"}
              onStitch={() => stitch.sendFiles(files)}
              onCropOnly={() => navigateToCrop(path[selectedIndex])}
            />
          )}
        </aside>

        {/* 右: ステージ（プレビュー・合成結果） */}
        <StitchStage
          state={stitch.state}
          imageCount={path.length}
          selectedIndex={selectedIndex}
          selectedSrc={path[selectedIndex]}
          isDownloading={stitch.isDownloading}
          downloadError={stitch.downloadError}
          onCrop={handleCropResult}
          onDownload={stitch.download}
        />
      </main>
    </AppShell>
  );
};
