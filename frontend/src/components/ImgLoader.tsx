"use client";

import { useState } from "react";
import { ImgSender } from "./ImgSender";

interface ImgLoaderProps {
  path: string[];
  image: string[];
  onCropOnly: (imageSrc: string) => void;
}

export const ImgLoader = ({ path, image, onCropOnly }: ImgLoaderProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const isMultiple = path.length > 1;

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
          {isMultiple && (
            <span className="text-[var(--text-muted)] text-sm">
              クリックでトリミング対象を選択
            </span>
          )}
        </div>

        {/* Thumbnail Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {path.map((value, index) => (
            <div
              key={`thumb-${index}`}
              onClick={() => setSelectedIndex(index)}
              className={`relative group aspect-square overflow-hidden rounded-lg border-2 bg-[var(--bg-secondary)] transition-all duration-200 cursor-pointer hover:scale-[1.02] ${
                selectedIndex === index
                  ? "border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30"
                  : "border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50"
              }`}
            >
              <img
                src={value}
                alt={`uploaded-${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className={`absolute inset-0 bg-gradient-to-t from-black/50 to-transparent transition-opacity ${
                selectedIndex === index ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`} />
              <span className={`absolute bottom-1 right-1 text-[10px] font-bold text-white transition-opacity ${
                selectedIndex === index ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}>
                {index + 1}
              </span>
              {selectedIndex === index && (
                <div className="absolute top-1 left-1">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="var(--accent-primary)"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 12 11 14 15 10" stroke="white" fill="none" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mode Selector & Send */}
      <ImgSender
        image={image}
        path={path}
        selectedIndex={selectedIndex}
        onCropOnly={onCropOnly}
      />
    </div>
  );
};
