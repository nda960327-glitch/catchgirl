import Link from "next/link";
import { redirect } from "next/navigation";
import { getStoreBySlug } from "@/lib/store";
import { getStaffUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { StaffNav } from "./staff-nav";
import { logoutStaff } from "../actions";

export default async function StaffLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const me = await getStaffUser(store.id);
  if (!me) redirect(`/${slug}/staff/login`);
  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl bg-paper md:my-6 md:min-h-0 md:rounded-[28px] md:border-[6px] md:border-white md:shadow-pop">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/90 px-5 py-3 backdrop-blur md:rounded-t-[22px]">
        <Avatar src={parseJsonArray(me.photos)[0]} name={me.nickname} size={38} rounded={12} />
        <div className="flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-gold">{store.name} · Staff</div>
          <div className="font-serif text-[15px] font-bold text-ink">{me.nickname}</div>
        </div>
        <Link href={`/${slug}/bartenders/${me.id}`} target="_blank" className="text-[11px] font-semibold text-brand">내 프로필 ↗</Link>
        <form action={logoutStaff.bind(null, slug)}><button className="rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-semibold text-mute">로그아웃</button></form>
      </header>
      <StaffNav slug={slug} />
      <main className="px-4 pb-10 pt-4">{children}</main>
    </div>
  );
}
