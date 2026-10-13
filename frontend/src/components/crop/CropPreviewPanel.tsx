import { StepHeader } from "../StepHeader";
import { DownloadIcon, ImagePlaceholderIcon } from "../icons";

interface CropPreviewPanelProps {
  croppedImageUrl: string | null;
}

export const CropPreviewPanel = ({ croppedImageUrl }: CropPreviewPanelProps) => (
  <section
    className="glass-card-elevated flex flex-col p-4 sm:p-5 fade-in desk:min-h-[220px] desk:flex-1"
    style={{ animationDelay: "0.1s" }}
  >
    <StepHeader
      step={5}
      title="プレビュー"
      description="切り取り後の画像がここに表示されます"
      inactive={!croppedImageUrl}
      className="mb-4"
    />

    {croppedImageUrl ? (
      <div className="flex flex-col gap-4 scale-in desk:min-h-0 desk:flex-1">
        <div className="stage-canvas flex items-center justify-center p-3 desk:min-h-0 desk:flex-1 desk:p-0">
          <div className="flex items-center justify-center desk:absolute desk:inset-3">
            <img
              alt="Cropped result"
              src={croppedImageUrl}
              className="stage-image max-h-[50dvh] w-auto max-w-full object-contain desk:h-full desk:max-h-none desk:w-full desk:rounded-none desk:shadow-none"
            />
          </div>
        </div>
        <a href={croppedImageUrl} download="cropped-image.jpg" className="btn-primary w-full">
          <DownloadIcon />
          画像をダウンロード
        </a>
      </div>
    ) : (
      <div className="placeholder min-h-[160px] flex-1 rounded-lg border border-dashed border-[var(--border-subtle)] py-8">
        <ImagePlaceholderIcon className="placeholder-icon h-14 w-14 text-[var(--text-muted)]" />
        <div className="placeholder-text text-[13px]">
          <p>編集エリアで範囲を選択し</p>
          <p>「選択範囲を切り取る」を押してください</p>
        </div>
      </div>
    )}
  </section>
);
