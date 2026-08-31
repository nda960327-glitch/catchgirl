import { getStoreBySlug } from "@/lib/store";
import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const { slug } = await params;
  const { next } = await searchParams;
  const store = await getStoreBySlug(slug);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-frame p-6">
      <div className="w-full max-w-sm rounded-[28px] border border-white bg-white/80 p-8 shadow-pop backdrop-blur">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {store.logoUrl && <img src={store.logoUrl} alt="" className="h-11 w-11 rounded-[14px]" />}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-gold">Admin</div>
            <div className="font-serif text-[20px] font-bold text-ink">{store.name} 관리자</div>
          </div>
        </div>
        <AdminLoginForm slug={slug} next={next} />
        <div className="mt-6 text-center text-[10px] text-mute">데모 — admin@catchgirl.app / 1234</div>
      </div>
    </main>
  );
}
