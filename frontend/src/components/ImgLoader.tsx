"use client";

import Image from "next/image";
import { v4 as uuidv4 } from "uuid";
import { ImgSender } from "./ImgSender";

interface ImgLoaderProps {
  path: string[];
  image: string[];
}

export const ImgLoader = ({ path, image }: ImgLoaderProps) => {
  return (
    <div>
      <div className="mt-8">
        <b>{path.length}枚の画像が読み込まれました</b>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {path.map((value) => (
            <img
              key={uuidv4()}
              src={value}
              alt="uploaded"
              className="w-24 border border-[#333] rounded-lg"
            />
          ))}
        </div>
      </div>

      <ImgSender image={image} />
    </div>
  );
};
