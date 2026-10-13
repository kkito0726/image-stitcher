import axios from "axios";

export type StitchMode = "Scans" | "Panorama";

export type StitchState =
  | { phase: "idle" }
  | { phase: "processing" }
  | { phase: "success"; previewUrl: string; resultId: string }
  | { phase: "failed"; reason: string }
  | { phase: "error"; message: string };

// 既定は軽量な JPEG。無劣化が必要な場合のみ PNG を明示的に選ぶ
export type DownloadFormat = "jpeg" | "png";

export const DOWNLOAD_EXTENSIONS: Record<DownloadFormat, string> = { jpeg: "jpg", png: "png" };

export const toErrorState = async (err: unknown): Promise<StitchState> => {
  if (axios.isAxiosError(err) && err.response) {
    const { status, data } = err.response;
    try {
      const text = data instanceof Blob ? await data.text() : JSON.stringify(data);
      const body = JSON.parse(text);
      if (status === 422) {
        return { phase: "failed", reason: body.reason ?? "unknown" };
      }
      if (typeof body.error === "string") {
        return { phase: "error", message: body.error };
      }
    } catch {
      // JSON でないレスポンスはステータスコードのみ表示する
    }
    return { phase: "error", message: `サーバーエラーが発生しました (${status})` };
  }
  return { phase: "error", message: "サーバーに接続できませんでした" };
};

export const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const postStitch = (mode: StitchMode, files: File[]) => {
  const formData = new FormData();
  formData.append("mode", mode);
  files.forEach((file) => formData.append("images", file));
  return axios.post("/api/stitch", formData, { responseType: "blob" });
};

export const requestFullImage = (resultId: string, format: DownloadFormat) =>
  axios.get(`/api/stitch/${resultId}/download`, {
    params: { format },
    responseType: "blob",
  });
