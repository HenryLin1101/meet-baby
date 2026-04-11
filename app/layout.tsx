import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "米特寶寶",
  description: "LINE 官方帳號 Webhook（Next.js App Router）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
