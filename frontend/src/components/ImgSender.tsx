"use client";

import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useImageContext } from "@/context/ImageContext";

interface ImgSenderProps {
  image: string[];
}

interface Status {
  recieveData: string | null;
  isStitched: number | null;
  isRecieved: boolean;
}

export const ImgSender = ({ image }: ImgSenderProps) => {
  const router = useRouter();
  const { setCropImageSrc } = useImageContext();
  const [mode, setMode] = useState<string>("Scans");
  const [isProcess, setIsProcess] = useState<boolean>(false);
  const [status, setStatus] = useState<Status>({
    recieveData: null,
    isStitched: null,
    isRecieved: false,
  });

  const initStatus = () => {
    setIsProcess(false);
    setStatus({
      recieveData: null,
      isStitched: null,
      isRecieved: false,
    });
  };

  const sendPath = () => {
    initStatus();

    const url = "http://127.0.0.1:5003/stitch";
    const sendData = {
      mode: mode,
      image: image,
    };
    setIsProcess(true);
    axios.post(url, sendData, {
      headers: {
        "content-type": "application/json",
      },
    })
      .then((res) => {
        setStatus({
          recieveData: res.data.base64Data,
          isStitched: res.data.isStitched,
          isRecieved: true,
        });
        setIsProcess(false);
      })
      .catch((err) => {
        console.log(err);
        setIsProcess(false);
      });
  };

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setMode(e.target.value);
  };

  const handleNavigateToCrop = () => {
    if (status.recieveData) {
      setCropImageSrc(`data:image/png;base64,${status.recieveData}`);
      router.push("/crop");
    }
  };

  return (
    <div>
      <div className="shadow-lg border-2 border-[#333] p-9 relative bg-[#2a2a2a] rounded-lg mt-8 text-[#f0f0f0]">
        <h2 className="text-xl font-bold mb-4">2. モードの選択</h2>
        <div className="border-2 border-dashed border-[#aaa] rounded-lg bg-[#2a2a2a] shadow p-5 my-5 text-center">
          <ul className="text-left mb-4 list-disc pl-6">
            <li>
              スキャンモード: 顕微鏡写真など奥行きを考慮しなくて良いもの
              (アフィン投影)
            </li>
            <li>パノラマモード: 風景の写真など奥行きがあるもの (球面投影)</li>
          </ul>
          <select
            name="mode"
            onChange={handleChange}
            className="bg-[#2a2a2a] shadow text-base rounded-lg py-2 px-4 border border-[#ccc] w-full max-w-md text-[#f0f0f0]"
          >
            <option defaultValue="Scans" value="Scans">
              スキャンモード
            </option>
            <option value="Panorama">パノラマモード</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={sendPath}
        className="inline-block rounded-lg text-base text-center cursor-pointer py-3 px-3 bg-[#444] text-[#f0f0f0] transition-all duration-300 shadow border-2 border-[#333] mt-4 mb-4 hover:shadow-none hover:bg-[#555] hover:text-white"
      >
        読み込まれた画像とモードを確認してStitching
      </button>

      {isProcess && (
        <div className="my-4">
          <div className="flex flex-col items-center justify-center gap-3">
            <p>処理中です...</p>
            <div className="w-48 h-2 bg-[#333] rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-green-400 rounded-full animate-progress-slide" />
            </div>
          </div>
        </div>
      )}

      {status.isRecieved && status.isStitched === 0 && (
        <div className="shadow-lg border-2 border-[#333] p-9 relative bg-[#2a2a2a] rounded-lg mt-8 text-[#f0f0f0]">
          <h2 className="text-xl font-bold mb-4">
            3. 実行結果を確認して画像を保存する
          </h2>
          {status.recieveData && (
            <img
              src={`data:image/png;base64,${status.recieveData}`}
              alt="stitched"
              className="border border-[#333] rounded-lg max-w-[640px] mx-auto"
            />
          )}
          <br />
          <button
            onClick={handleNavigateToCrop}
            className="inline-block rounded-lg text-base text-center cursor-pointer py-3 px-3 bg-[#444] text-[#f0f0f0] transition-all duration-300 shadow border-2 border-[#333] mt-4 hover:shadow-none hover:bg-[#555] hover:text-white"
          >
            トリミングする
          </button>
        </div>
      )}

      {status.isRecieved && status.isStitched === 1 && (
        <div className="shadow-lg border-2 border-[#333] p-9 relative bg-[#2a2a2a] rounded-lg mt-8 text-[#f0f0f0]">
          <h2 className="text-xl font-bold mb-4">重ね合わせられませんでした...</h2>
          <div className="border-2 border-dashed border-[#aaa] rounded-lg bg-[#2a2a2a] shadow p-5 my-5 text-center">
            <h3 className="text-lg font-semibold mb-2">パノラマ合成のコツ</h3>
            <p>
              特徴点同士を合わせられず、エラーになりました。
              <br />
              画像の重なり合う部分(のりしろ)を増やして写真を撮影しましょう!!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
