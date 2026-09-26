import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Panorama Image Stitcher",
  description: "画像を重ね合わせてパノラマ写真を作成",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <Providers>{children}</Providers>
        <footer className="px-6 py-4 text-center text-xs text-[var(--text-muted)]">
          利用状況の把握と障害対応のため、ブラウザごとのランダムな匿名 ID とブラウザの種類 (User-Agent)
          をアクセスログに記録します。アクセスログに IP アドレスは記録しません。アップロードした画像は
          保存せず、合成結果はダウンロード用に最大 10 分間メモリに保持した後に破棄します。
        </footer>
      </body>
    </html>
  );
}
