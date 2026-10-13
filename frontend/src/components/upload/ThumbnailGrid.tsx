"use client";

interface ThumbnailGridProps {
  path: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export const ThumbnailGrid = ({ path, selectedIndex, onSelect }: ThumbnailGridProps) => {
  const isMultiple = path.length > 1;

  return (
    <div className="fade-in desk:flex desk:min-h-0 desk:flex-1 desk:flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[var(--success)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {path.length}枚の画像を読み込みました
          </span>
        </div>
        {isMultiple && (
          <span className="shrink-0 text-xs text-[var(--text-muted)]">
            <span className="hidden sm:inline">クリックで選択</span>
            <span className="sm:hidden">タップで選択</span>
          </span>
        )}
      </div>

      {/* desk 幅では残りの高さに合わせて縮み、溢れた分はこの中だけスクロールする */}
      <div className="panel-scroll -m-1 p-1 desk:min-h-16 desk:flex-1 desk:overflow-y-auto">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
        {path.map((value, index) => {
          const isSelected = selectedIndex === index;
          return (
            <button
              type="button"
              key={`thumb-${index}`}
              onClick={() => onSelect(index)}
              aria-pressed={isSelected}
              aria-label={`${index + 1}枚目を選択`}
              className={`group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 bg-[var(--bg-secondary)] transition-all duration-200 hover:scale-[1.02] ${
                isSelected
                  ? "border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30"
                  : "border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50"
              }`}
            >
              <img src={value} alt={`uploaded-${index + 1}`} className="h-full w-full object-cover" />
              <div
                className={`absolute inset-0 bg-gradient-to-t from-black/50 to-transparent transition-opacity ${
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              />
              <span
                className={`absolute bottom-1 right-1 text-[10px] font-bold text-white transition-opacity ${
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {index + 1}
              </span>
              {isSelected && (
                <div className="absolute left-1 top-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent-primary)" stroke="white" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 12 11 14 15 10" stroke="white" fill="none" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
};
