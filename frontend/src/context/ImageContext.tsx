"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ImageContextType {
  cropImageSrc: string | null;
  setCropImageSrc: (src: string | null) => void;
}

const ImageContext = createContext<ImageContextType | undefined>(undefined);

export function ImageProvider({ children }: { children: ReactNode }) {
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  return (
    <ImageContext.Provider value={{ cropImageSrc, setCropImageSrc }}>
      {children}
    </ImageContext.Provider>
  );
}

export function useImageContext() {
  const context = useContext(ImageContext);
  if (context === undefined) {
    throw new Error("useImageContext must be used within an ImageProvider");
  }
  return context;
}
