"use client";

import { useState, ChangeEvent } from "react";
import Image from "next/image";
import { Topbar } from "./Topbar";
import { ImgLoader } from "./ImgLoader";

export const FileUploader = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [path, setPath] = useState<string[]>([]);
  const [dataUrl, setDataUrl] = useState<string[]>([]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const dataURLs: string[] = [];
      const filesPath: string[] = [];

      for (let i = 0; i < files.length; i++) {
        filesPath.push(window.URL.createObjectURL(files[i]));

        const reader = new FileReader();
        reader.readAsDataURL(files[i]);

        reader.onload = (e) => {
          const str = e.target?.result as string;
          if (str) {
            dataURLs.push(str.substr(str.indexOf(",") + 1));
          }
        };
      }
      setDataUrl(dataURLs);
      setPath(filesPath);
      setLoading(true);
    }
  };

  return (
    <div className="min-h-screen">
      <Topbar />

      <div className="flex flex-col items-center justify-center text-center p-8 bg-[#2a2a2a] shadow-lg rounded-lg m-5 text-[#f0f0f0] min-h-[88vh]">
        <div
          className="shadow-lg border-2 border-[#333] py-9 px-15 relative bg-[#2a2a2a] rounded-lg mt-8 text-[#f0f0f0] hover:shadow-none hover:bg-[#3a3a3a] transition-all"
        >
          <h2 className="text-xl font-bold mb-4">1. フォルダから画像を選択</h2>
          <div className="border-2 border-dashed border-[#aaa] rounded-lg mb-0">
            <p className="mt-4">JpegかPngの画像ファイル</p>
            <Image
              src="/fileImage.svg"
              alt="imagelogo"
              width={64}
              height={64}
              className="mx-auto my-2"
            />
            <p className="mb-4">ここにドラッグ＆ドロップ</p>
          </div>
          <input
            className="opacity-0 absolute top-0 left-0 w-full h-full cursor-pointer"
            multiple
            name="imageURL"
            type="file"
            accept=".png, .jpeg, .jpg"
            onChange={handleFileChange}
          />
          <p className="my-4">または</p>
          <button className="relative inline-block rounded-lg text-base text-center cursor-pointer py-3 px-3 bg-[#444] text-[#f0f0f0] transition-all duration-300 shadow border-2 border-[#333] hover:shadow-none hover:bg-[#555] hover:text-white">
            画像ファイルを選択
            <input
              className="opacity-0 absolute top-0 left-0 w-full h-full cursor-pointer"
              type="file"
              accept=".png, .jpeg, .jpg, .tif, .bmp"
              multiple
              onChange={handleFileChange}
            />
          </button>
        </div>

        {loading && <ImgLoader path={path} image={dataUrl} />}

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-block rounded-lg text-sm text-center cursor-pointer py-3 px-3 bg-[#555] text-[#f0f0f0] transition-all duration-300 shadow border border-dashed border-[#333] mt-8 hover:shadow-none hover:text-white"
        >
          はじめからやり直す
        </button>
      </div>
    </div>
  );
};
