"use client";

import { ImageProvider } from "@/context/ImageContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ImageProvider>{children}</ImageProvider>;
}
