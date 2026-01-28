"use client";

import Link from "next/link";

export const Topbar = () => {
  return (
    <nav className="flex items-center justify-between w-full bg-[#1a1a1a] border-b border-[#444] sticky top-0 z-50 px-2 py-1">
      <Link href="/" className="p-2 rounded hover:bg-zinc-900 transition-colors">
        <span className="text-slate-200">
          Image <span className="text-green-400">Stitcher</span>
        </span>
      </Link>
      <div className="text-slate-200">
        LaR<span className="text-green-400">Code</span>
      </div>
    </nav>
  );
};
