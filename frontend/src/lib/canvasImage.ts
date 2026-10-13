import type { Crop } from "react-image-crop";

// 画像を回転させる関数
export const rotateImage = (imageSrc: string, degrees: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      const radians = (degrees * Math.PI) / 180;

      // 回転後のキャンバスサイズを計算
      const sin = Math.abs(Math.sin(radians));
      const cos = Math.abs(Math.cos(radians));
      const newWidth = image.width * cos + image.height * sin;
      const newHeight = image.width * sin + image.height * cos;

      canvas.width = newWidth;
      canvas.height = newHeight;

      // キャンバスの中心に移動して回転
      ctx.translate(newWidth / 2, newHeight / 2);
      ctx.rotate(radians);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          const url = URL.createObjectURL(blob);
          resolve(url);
        },
        "image/jpeg",
        0.95
      );
    };
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = imageSrc;
  });

export const getCroppedImg = (image: HTMLImageElement, cropData: Crop): Promise<string> => {
  const canvas = document.createElement("canvas");
  const pixelRatio = window.devicePixelRatio;
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return Promise.reject(new Error("Canvas context not available"));
  }

  // crop値がパーセントの場合はピクセルに変換
  const cropX = cropData.unit === "%" ? (cropData.x / 100) * image.width : cropData.x;
  const cropY = cropData.unit === "%" ? (cropData.y / 100) * image.height : cropData.y;
  const cropWidth = cropData.unit === "%" ? (cropData.width / 100) * image.width : cropData.width;
  const cropHeight = cropData.unit === "%" ? (cropData.height / 100) * image.height : cropData.height;

  canvas.width = cropWidth * pixelRatio * scaleX;
  canvas.height = cropHeight * pixelRatio * scaleY;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    cropX * scaleX,
    cropY * scaleY,
    cropWidth * scaleX,
    cropHeight * scaleY,
    0,
    0,
    cropWidth * scaleX,
    cropHeight * scaleY
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error("Canvas is empty");
          return;
        }
        const fileUrl = window.URL.createObjectURL(blob);
        resolve(fileUrl);
      },
      "image/jpeg",
      1
    );
  });
};
