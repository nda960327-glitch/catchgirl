import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "캐치걸_어나더 — 오늘 밤, 당신의 캐치걸",
  description: "캐치걸 지정 실시간 예약",
  icons: { icon: "/assets/icon.webp", apple: "/assets/icon.webp" },
  // 매니페스트는 매장·역할마다 다르므로 각 레이아웃에서 지정한다
  appleWebApp: { capable: true, statusBarStyle: "default", title: "캐치걸" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#FCF7F6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
