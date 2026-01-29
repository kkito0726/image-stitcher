"use client";

import { useState, ChangeEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "./Topbar";
import { ImgLoader } from "./ImgLoader";
import { useImageContext } from "@/context/ImageContext";

export const FileUploader = () => {
  const router = useRouter();
  const { setCropImageSrc } = useImageContext();
  const [loading, setLoading] = useState<boolean>(false);
  const [path, setPath] = useState<string[]>([]);
  const [dataUrl, setDataUrl] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    processFiles(files);
  };

  const processFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      const dataURLs: string[] = [];
      const filesPath: string[] = [];

      for (let i = 0; i < files.length; i++) {
        filesPath.push(window.URL.createObjectURL(files[i]));

        const reader = new FileReader();
        reader.readAsDataURL(files[i]);

        reader.onload = (e) => {
          const str = e.target?.result as string;
          if (str) {
            dataURLs.push(str.substr(str.indexOf(",") + 1));
          }
        };
      }
      setDataUrl(dataURLs);
      setPath(filesPath);
      setLoading(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleCropOnly = (imageSrc: string) => {
    setCropImageSrc(imageSrc);
    router.push("/crop");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-void)]">
      <Topbar />

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero Section */}
        <div className="text-center mb-10 fade-in">
          <h1 className="text-3xl font-semibold text-[var(--text-primary)] mb-3 tracking-tight">
            Panorama Image Stitcher
          </h1>
          <p className="text-[var(--text-secondary)] text-base max-w-lg mx-auto">
            複数の画像を自動で合成し、美しいパノラマ写真を作成します
          </p>
        </div>

        {/* Upload Card */}
        <div className="glass-card-elevated p-8 fade-in" style={{ animationDelay: "0.1s" }}>
          {/* Step 1 Header */}
          <div className="section-title">
            <span className="step-badge">1</span>
            <div>
              <h2>画像をアップロード</h2>
              <p>JPEGまたはPNG形式の画像を選択してください</p>
            </div>
          </div>

          {/* Dropzone */}
          <div
            className={`dropzone text-center transition-all ${
              isDragOver ? "border-[var(--accent-primary)] bg-[var(--accent-glow)]" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleButtonClick}
          >
            {/* Icon */}
            <div className="dropzone-icon mx-auto">
              <svg
                viewBox="0 0 64 64"
                fill="none"
                className="w-full h-full"
              >
                <rect
                  x="8"
                  y="14"
                  width="28"
                  height="20"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-[var(--accent-primary)]"
                  opacity="0.5"
                />
                <rect
                  x="28"
                  y="20"
                  width="28"
                  height="20"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-[var(--accent-primary)]"
                />
                <rect
                  x="18"
                  y="30"
                  width="28"
                  height="20"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-[var(--accent-secondary)]"
                  opacity="0.7"
                />
                <path
                  d="M32 44V56M32 56L26 50M32 56L38 50"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[var(--text-muted)]"
                />
              </svg>
            </div>

            <p className="text-[var(--text-primary)] font-medium mb-2">
              ここにファイルをドロップ
            </p>
            <p className="text-[var(--text-muted)] text-sm mb-6">
              または
            </p>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleButtonClick();
              }}
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
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              画像を選択
            </button>

            <input
              ref={fileInputRef}
              className="hidden"
              multiple
              name="imageURL"
              type="file"
              accept=".png, .jpeg, .jpg"
              onChange={handleFileChange}
            />
          </div>

          {/* File format hint */}
          <p className="text-center text-[var(--text-muted)] text-xs mt-4">
            対応形式: JPEG, PNG / 複数選択可
          </p>
        </div>

        {/* Loaded Images Section */}
        {loading && (
          <div className="mt-8 fade-in">
            <ImgLoader path={path} image={dataUrl} onCropOnly={handleCropOnly} />
          </div>
        )}

        {/* Reset Button */}
        <div className="text-center mt-10 fade-in" style={{ animationDelay: "0.2s" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-ghost"
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
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            はじめからやり直す
          </button>
        </div>
      </main>
    </div>
  );
};
