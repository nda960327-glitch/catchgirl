import { getStoreBySlug } from "@/lib/store";
import { Sticker } from "@/components/ui";
import { StaffLoginForm } from "./login-form";
import { staffLabelOf } from "@/lib/labels";

export default async function StaffLoginPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const { slug } = await params;
  const { next } = await searchParams;
  const store = await getStoreBySlug(slug);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-frame p-6">
      <div className="w-full max-w-sm rounded-[28px] border border-card bg-card/80 p-8 text-center shadow-pop backdrop-blur">
        <Sticker k="p9" size={90} className="mx-auto" />
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[.2em] text-gold">Staff</div>
        <div className="font-serif text-[20px] font-bold text-ink">{store.name} {staffLabelOf(store)} 로그인</div>
        <StaffLoginForm slug={slug} next={next} />
        <div className="mt-6 text-[10px] text-mute">데모 — junhee / yeri / hayoung · 비밀번호 1234</div>
      </div>
    </main>
  );
}
