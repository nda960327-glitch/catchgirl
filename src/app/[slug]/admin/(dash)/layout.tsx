import { redirect } from "next/navigation";
import { getStoreBySlug } from "@/lib/store";
import { getAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";



export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const admin = await getAdmin(store.id);
  if (!admin) redirect(`/${slug}/admin/login`);
  return (
    <div className="flex min-h-dvh bg-frame">
      <AdminNav slug={slug} storeName={store.name} logoUrl={store.logoUrl} adminName={admin.name} plan={store.plan} />
      <main className="min-w-0 flex-1 px-4 pb-10 pt-16 md:px-8 md:pt-6">{children}</main>
    </div>
  );
}
