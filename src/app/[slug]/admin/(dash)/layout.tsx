import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStoreBySlug } from "@/lib/store";
import { getAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";


/** 역할마다 다른 앱으로 설치되도록 매니페스트와 아이콘을 따로 준다 */
export const metadata: Metadata = {
  title: "캐치걸_어나더 관리자",
  manifest: "/manifest-admin.json",
  themeColor: "#3E6FA8",
  icons: { icon: "/assets/icon-admin-192.png", apple: "/assets/icon-admin-192.png" },
};

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const admin = await getAdmin(store.id);
  if (!admin) redirect(`/${slug}/admin/login`);
  return (
    <div className="flex min-h-dvh bg-frame">
      <AdminNav slug={slug} storeName={store.name} logoUrl={store.logoUrl} adminName={admin.name} />
      <main className="min-w-0 flex-1 px-4 pb-10 pt-16 md:px-8 md:pt-6">{children}</main>
    </div>
  );
}
