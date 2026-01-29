"use client";

import Link from "next/link";

export const Topbar = () => {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between w-full px-6 py-3 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)]">
      <Link
        href="/"
        className="group flex items-center gap-2 no-underline transition-all duration-200"
      >
        {/* Logo Icon */}
        <div className="relative w-8 h-8 flex items-center justify-center">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className="w-full h-full"
          >
            {/* Overlapping layers representing stitched images */}
            <rect
              x="4"
              y="6"
              width="14"
              height="10"
              rx="2"
              className="fill-[var(--accent-primary)] opacity-60"
            />
            <rect
              x="14"
              y="10"
              width="14"
              height="10"
              rx="2"
              className="fill-[var(--accent-primary)]"
            />
            <rect
              x="9"
              y="16"
              width="14"
              height="10"
              rx="2"
              className="fill-[var(--accent-secondary)] opacity-80"
            />
          </svg>
        </div>

        {/* Logo Text */}
        <span className="font-semibold text-[15px] tracking-tight">
          <span className="text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors">
            Image
          </span>
          <span className="text-[var(--accent-primary)] ml-0.5">Stitcher</span>
        </span>
      </Link>

      {/* Brand Badge */}
      <div className="flex items-center gap-2">
        <span className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-glass)] border border-[var(--border-subtle)] rounded-full">
          LaR<span className="text-[var(--accent-primary)]">Code</span>
        </span>
      </div>
    </nav>
  );
};
