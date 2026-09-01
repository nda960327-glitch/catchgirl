import type { Metadata } from "next";

/**
 * 직원 앱으로 따로 설치되도록 매니페스트와 아이콘을 여기서 준다.
 * 로그인 화면에서 설치해도 직원 앱이 깔려야 하므로 /staff 전체를 덮는다.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "캐치걸_어나더 직원",
    manifest: `/${slug}/staff/manifest.webmanifest`,
    icons: { icon: "/assets/icon-staff-192.png", apple: "/assets/icon-staff-192.png" },
  };
}

export const viewport = { themeColor: "#C8A46A" };

export default function StaffRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
