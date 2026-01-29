"use client";

import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useImageContext } from "@/context/ImageContext";

interface ImgSenderProps {
  image: string[];
  path: string[];
  selectedIndex: number;
  onCropOnly: (imageSrc: string) => void;
}

interface Status {
  recieveData: string | null;
  isStitched: number | null;
  isRecieved: boolean;
}

export const ImgSender = ({ image, path, selectedIndex, onCropOnly }: ImgSenderProps) => {
  const isSingleImage = image.length === 1;
  const router = useRouter();
  const { setCropImageSrc } = useImageContext();
  const [mode, setMode] = useState<string>("Scans");
  const [isProcess, setIsProcess] = useState<boolean>(false);
  const [status, setStatus] = useState<Status>({
    recieveData: null,
    isStitched: null,
    isRecieved: false,
  });

  const initStatus = () => {
    setIsProcess(false);
    setStatus({
      recieveData: null,
      isStitched: null,
      isRecieved: false,
    });
  };

  const sendPath = () => {
    initStatus();

    const url = "/api/stitch";
    const sendData = {
      mode: mode,
      image: image,
    };
    setIsProcess(true);
    axios
      .post(url, sendData, {
        headers: {
          "content-type": "application/json",
        },
      })
      .then((res) => {
        setStatus({
          recieveData: res.data.base64Data,
          isStitched: res.data.isStitched,
          isRecieved: true,
        });
        setIsProcess(false);
      })
      .catch((err) => {
        console.log(err);
        setIsProcess(false);
      });
  };

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setMode(e.target.value);
  };

  const handleNavigateToCrop = () => {
    if (status.recieveData) {
      setCropImageSrc(`data:image/png;base64,${status.recieveData}`);
      router.push("/crop");
    }
  };

  return (
    <div className="space-y-6">
      {/* Single Image: Crop Only */}
      {isSingleImage ? (
        <div className="glass-card-elevated p-6 fade-in">
          <div className="section-title">
            <span className="step-badge">2</span>
            <div>
              <h2>トリミング</h2>
              <p>画像を編集できます</p>
            </div>
          </div>

          <div className="info-box mb-5">
            <p>1枚の画像が選択されています。トリミング画面で回転や切り取りができます。</p>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => onCropOnly(path[selectedIndex])}
              className="btn-primary text-base px-8 py-4"
            >
              <svg
                width="20"
                height="20"
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
              トリミングへ進む
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mode Selection Card */}
          <div className="glass-card-elevated p-6 fade-in">
            <div className="section-title">
              <span className="step-badge">2</span>
              <div>
                <h2>合成モードを選択</h2>
                <p>撮影した画像の種類に合わせて選択してください</p>
              </div>
            </div>

            {/* Mode Info */}
            <div className="info-box mb-5">
              <ul>
                <li>
                  <span className="text-[var(--text-primary)] font-medium">スキャンモード</span>
                  <span className="text-[var(--text-muted)]"> — </span>
                  顕微鏡写真など奥行きを考慮しないもの（アフィン投影）
                </li>
                <li>
                  <span className="text-[var(--text-primary)] font-medium">パノラマモード</span>
                  <span className="text-[var(--text-muted)]"> — </span>
                  風景写真など奥行きがあるもの（球面投影）
                </li>
              </ul>
            </div>

            {/* Select */}
            <select
              name="mode"
              onChange={handleChange}
              className="select-modern max-w-sm"
            >
              <option defaultValue="Scans" value="Scans">
                スキャンモード
              </option>
              <option value="Panorama">パノラマモード</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={sendPath}
              disabled={isProcess}
              className="btn-primary text-base px-8 py-4"
            >
              {isProcess ? (
                <>
                  <span className="pulse-dot" />
                  処理中...
                </>
              ) : (
                <>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  画像を合成する
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onCropOnly(path[selectedIndex])}
              disabled={isProcess}
              className="btn-secondary text-base px-6 py-4"
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
              トリミングのみ（{selectedIndex + 1}枚目）
            </button>
          </div>
        </>
      )}

      {/* Processing Indicator */}
      {isProcess && (
        <div className="fade-in">
          <div className="glass-card p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-[var(--border-subtle)]" />
                <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-medium mb-1">
                  画像を合成しています
                </p>
                <p className="text-[var(--text-muted)] text-sm">
                  しばらくお待ちください...
                </p>
              </div>
              <div className="w-48 progress-bar">
                <div className="progress-bar-fill w-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Result */}
      {status.isRecieved && status.isStitched === 0 && (
        <div className="glass-card-elevated p-6 scale-in">
          <div className="section-title">
            <span className="step-badge">3</span>
            <div>
              <h2>合成完了</h2>
              <p>画像の合成に成功しました</p>
            </div>
          </div>

          {/* Result Preview */}
          <div className="result-image-container mb-6">
            {status.recieveData && (
              <img
                src={`data:image/png;base64,${status.recieveData}`}
                alt="stitched"
                className="result-image w-full"
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleNavigateToCrop}
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
                <path d="M6 2L6 6L2 6" />
                <path d="M6 6L12 12" />
                <path d="M18 22L18 18L22 18" />
                <path d="M18 18L12 12" />
                <rect x="8" y="8" width="8" height="8" rx="1" />
              </svg>
              トリミングする
            </button>
            <a
              href={`data:image/png;base64,${status.recieveData}`}
              download="stitched-image.png"
              className="btn-secondary"
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
              ダウンロード
            </a>
          </div>
        </div>
      )}

      {/* Error Result */}
      {status.isRecieved && status.isStitched === 1 && (
        <div className="glass-card p-6 border-red-500/20 scale-in">
          <div className="section-title mb-4">
            <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <h2 className="text-red-400">合成できませんでした</h2>
              <p>画像の特徴点を検出できなかったようです</p>
            </div>
          </div>

          <div className="status-error">
            <h3 className="text-[var(--text-primary)] font-medium mb-2">
              パノラマ合成のコツ
            </h3>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              特徴点同士を合わせられず、エラーになりました。
              <br />
              画像の重なり合う部分（のりしろ）を増やして撮影し直してみてください。
              目安として、隣り合う画像の30%以上が重なるようにすると成功率が上がります。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
