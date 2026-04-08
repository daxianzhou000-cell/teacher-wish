import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { EntranceGate } from "@/components/entrance-gate";
import { SiteNav } from "@/components/site-nav";

import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "课糖 (Class Candy)",
  description: "让备课像吃糖一样简单、有温度",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteNav />
        <Suspense fallback={null}>
          <EntranceGate />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
