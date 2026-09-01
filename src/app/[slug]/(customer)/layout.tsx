import type { Metadata } from "next";
import { getStoreBySlug } from "@/lib/store";
import { CustomerShell } from "@/components/tabbar";

/** 손님 앱 — 관리자·직원 앱과 따로 깔리도록 매장별 매니페스트를 가리킨다 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { manifest: `/${slug}/manifest.webmanifest` };
}

export default async function CustomerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await getStoreBySlug(slug);
  return <CustomerShell slug={slug}>{children}</CustomerShell>;
}
