"use client";

import { useCallback, useState } from "react";
import axios from "axios";
import {
  DOWNLOAD_EXTENSIONS,
  postStitch,
  requestFullImage,
  saveBlob,
  toErrorState,
  type DownloadFormat,
  type StitchMode,
  type StitchState,
} from "@/lib/stitchApi";

export const useStitch = () => {
  const [mode, setMode] = useState<StitchMode>("Scans");
  const [state, setState] = useState<StitchState>({ phase: "idle" });
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const revokePreview = useCallback(() => {
    if (state.phase === "success") {
      URL.revokeObjectURL(state.previewUrl);
    }
  }, [state]);

  // 新しい画像が読み込まれたら前回の結果を破棄する。
  // アンマウント時には revoke しない（/crop が同じ previewUrl を参照するため）
  const reset = useCallback(() => {
    revokePreview();
    setDownloadError(null);
    setState({ phase: "idle" });
  }, [revokePreview]);

  const sendFiles = async (files: File[]) => {
    revokePreview();
    setDownloadError(null);
    setState({ phase: "processing" });

    try {
      const res = await postStitch(mode, files);
      const resultId = res.headers["x-result-id"];
      setState({ phase: "success", previewUrl: URL.createObjectURL(res.data), resultId });
    } catch (err) {
      setState(await toErrorState(err));
    }
  };

  const download = async (format: DownloadFormat) => {
    if (state.phase !== "success") return;
    setDownloadError(null);
    setIsDownloading(true);
    try {
      const res = await requestFullImage(state.resultId, format);
      saveBlob(res.data, `stitched-image.${DOWNLOAD_EXTENSIONS[format]}`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setDownloadError("画像の有効期限が切れました。もう一度合成してください。");
      } else {
        setDownloadError("ダウンロードに失敗しました。");
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return { mode, setMode, state, isDownloading, downloadError, sendFiles, download, reset };
};
