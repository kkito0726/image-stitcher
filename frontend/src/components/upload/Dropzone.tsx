"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { StackedPhotosIcon, UploadIcon } from "../icons";

interface DropzoneProps {
  /** 画像読み込み後は1行のコンパクト表示にして縦の領域を節約する */
  compact: boolean;
  onFiles: (fileList: FileList | null) => void;
}

export const Dropzone = ({ compact, onFiles }: DropzoneProps) => {
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => fileInputRef.current?.click();

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files);
    // 同じファイルを選び直しても onChange が発火するようにする
    e.target.value = "";
  };

  const dragClass = isDragOver ? "border-[var(--accent-primary)] bg-[var(--accent-glow)]" : "";

  return (
    <div
      className={`dropzone transition-all ${compact ? "px-4 py-2.5" : "px-5 py-8 text-center sm:py-10"} ${dragClass}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openPicker}
    >
      {compact ? (
        <div className="flex items-center gap-3">
          <StackedPhotosIcon className="h-8 w-8 shrink-0 opacity-80" />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-medium text-[var(--text-primary)]">画像を差し替える</p>
            <p className="hidden text-xs text-[var(--text-muted)] sm:block">クリックまたはドロップ</p>
            <p className="text-xs text-[var(--text-muted)] sm:hidden">タップして選び直す</p>
          </div>
          <UploadIcon size={18} className="shrink-0 text-[var(--accent-primary)]" />
        </div>
      ) : (
        <>
          <StackedPhotosIcon className="dropzone-icon mx-auto" />
          {/* タッチ端末ではドロップできないため文言を切り替える */}
          <p className="mb-2 hidden font-medium text-[var(--text-primary)] sm:block">ここにファイルをドロップ</p>
          <p className="mb-5 hidden text-sm text-[var(--text-muted)] sm:block">または</p>
          <p className="mb-5 text-sm text-[var(--text-secondary)] sm:hidden">端末の写真から複数枚を選べます</p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
            className="btn-primary w-full sm:w-auto"
          >
            <UploadIcon />
            画像を選択
          </button>
        </>
      )}

      <input
        ref={fileInputRef}
        className="hidden"
        multiple
        name="imageURL"
        type="file"
        accept=".png, .jpeg, .jpg"
        onChange={handleChange}
      />
    </div>
  );
};
