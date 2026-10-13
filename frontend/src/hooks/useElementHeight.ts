"use client";

import { useEffect, useState, type RefObject } from "react";

/** 要素の内容高さ(px)を ResizeObserver で追従する */
export const useElementHeight = (ref: RefObject<HTMLElement | null>): number | null => {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setHeight(Math.floor(entry.contentRect.height));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return height;
};
