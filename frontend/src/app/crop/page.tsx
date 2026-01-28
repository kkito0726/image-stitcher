"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useImageContext } from "@/context/ImageContext";
import { ImgCropper } from "@/components/ImgCropper";

export default function CropPage() {
  const router = useRouter();
  const { cropImageSrc } = useImageContext();

  useEffect(() => {
    if (!cropImageSrc) {
      router.replace("/");
    }
  }, [cropImageSrc, router]);

  if (!cropImageSrc) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[#f0f0f0]">
        <p>リダイレクト中...</p>
      </div>
    );
  }

  return <ImgCropper src={cropImageSrc} />;
}
