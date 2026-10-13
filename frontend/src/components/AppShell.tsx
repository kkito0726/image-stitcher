import type { ReactNode } from "react";
import { Topbar } from "./Topbar";

/**
 * 全ページ共通の外枠。
 * モバイルでは縦に自然スクロール、desk 幅では画面高さに固定して中身を1画面に収める。
 */
export const AppShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-dvh flex-col bg-[var(--bg-void)] desk:h-dvh desk:overflow-hidden">
    <Topbar />
    {children}
  </div>
);
