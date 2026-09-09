import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.catchgirl.kr"),
  title: { default: "캐치걸 | 바 전용 전담 바텐더 지명 예약 앱", template: "%s | 캐치걸" },
  description: "캐치걸은 바(bar) 전용 예약 앱이에요. 손님이 오늘 자기 자리를 맡을 전담 바텐더를 미리 지명해 예약하고, 매장은 출근·룸 배치·수금·재방문을 한 화면에서 관리해요. 손님 실명·전화번호는 받지 않아요.",
  applicationName: "캐치걸",
  keywords: ["캐치걸", "catchgirl", "바 예약 앱", "바텐더 지명 예약", "착석바 예약", "토킹바 예약", "칵테일바 예약", "매장 전용 앱", "바 운영 앱"],
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
