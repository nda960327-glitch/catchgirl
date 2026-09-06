import type { Metadata } from "next";
import { prisma } from "@/lib/db";

/**
 * 관리자 앱으로 따로 설치되도록 매니페스트와 아이콘을 여기서 준다.
 * 로그인 화면에서 설치해도 관리자 앱이 깔려야 하므로 (dash) 안이 아니라
 * /admin 전체를 덮는 이 자리에 둔다.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: `${store?.name ?? "캐치걸_어나더"} 관리자`,
    manifest: `/${slug}/admin/manifest.webmanifest`,
    icons: { icon: "/assets/icon-admin-192.png", apple: "/assets/icon-admin-192.png" },
  };
}

export const viewport = { themeColor: "#3E6FA8" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
