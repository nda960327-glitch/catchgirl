import { getStoreBySlug } from "@/lib/store";
import { CustomerShell } from "@/components/tabbar";

export default async function CustomerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await getStoreBySlug(slug);
  return <CustomerShell slug={slug}>{children}</CustomerShell>;
}
