"use client";

import { v4 as uuidv4 } from "uuid";
import { ImgSender } from "./ImgSender";

interface ImgLoaderProps {
  path: string[];
  image: string[];
  onCropOnly: (imageSrc: string) => void;
}

export const ImgLoader = ({ path, image, onCropOnly }: ImgLoaderProps) => {
  return (
    <div className="space-y-6 fade-in">
      {/* Loaded Images Preview */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
            <span className="text-[var(--text-primary)] font-medium">
              {path.length}枚の画像を読み込みました
            </span>
          </div>
          <span className="text-[var(--text-muted)] text-sm">
            プレビュー
          </span>
        </div>

        {/* Thumbnail Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {path.map((value, index) => (
            <div
              key={uuidv4()}
              className="relative group aspect-square overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] transition-all duration-200 hover:border-[var(--accent-primary)] hover:scale-[1.02]"
            >
              <img
                src={value}
                alt={`uploaded-${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute bottom-1 right-1 text-[10px] font-medium text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mode Selector & Send */}
      <ImgSender image={image} path={path} onCropOnly={onCropOnly} />
    </div>
  );
};
