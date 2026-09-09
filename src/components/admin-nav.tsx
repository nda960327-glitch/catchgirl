"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PLANS, planOf } from "@/lib/plans";
import { logoutAdmin } from "@/app/[slug]/admin/actions";
import { NewReservationAlert } from "@/components/new-reservation-alert";

const NAV = [
  { href: "", label: "대시보드", icon: "◫" },
  { href: "/reservations", label: "예약 관리", icon: "▤" },
  { href: "/collect", label: "수금", icon: "◎" },
  { href: "/revenue", label: "매출 관리", icon: "₩" },
  { href: "/staff", label: "직원 관리", icon: "♟" },
  { href: "/customers", label: "고객 관리", icon: "♡" },
  { href: "/reviews", label: "후기·댓글", icon: "✎" },
  { href: "/reports", label: "신고", icon: "⚑" },
  { href: "/discounts", label: "할인 관리", icon: "%" },
  { href: "/sources", label: "방문 경로", icon: "↯" },
  { href: "/settings", label: "매장 설정", icon: "⚙" },
  { href: "/plan", label: "요금제", icon: "◈" },
];

/** 구독 중인 요금제 뱃지 — Max 는 금색으로 한눈에 구분되게 */
export function PlanBadge({ plan, className }: { plan: string; className?: string }) {
  const p = planOf(plan);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.1em]",
        p === "MAX" ? "bg-gold text-white" : "bg-ink text-on-ink",
        className,
      )}
    >
      {PLANS[p].name}
    </span>
  );
}

export function AdminNav({ slug, storeName, logoUrl, adminName, plan }: { slug: string; storeName: string; logoUrl: string | null; adminName: string; plan: string }) {
  const path = usePathname();
  const base = `/${slug}/admin`;
  return (
    <>
      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-line bg-card/80 px-4 py-6 backdrop-blur md:flex">
        <Link href={`/${slug}`} className="flex items-center gap-2.5 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl ? <img src={logoUrl} alt="" className="h-9 w-9 rounded-xl" /> : <span className="h-9 w-9 rounded-xl bg-blush-lt" />}
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Admin</div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-[15px] font-bold text-ink">{storeName}</span>
              <PlanBadge plan={plan} />
            </div>
          </div>
        </Link>
        <nav className="mt-7 flex flex-col gap-1">
          {NAV.map((n) => {
            const href = base + n.href;
            const on = n.href === "" ? path === base : path.startsWith(href);
            return (
              <Link key={n.href} href={href} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", on ? "bg-brand text-white shadow-cta" : "text-mute hover:bg-blush-lt hover:text-brand")}>
                <span className="w-4 text-center text-[13px]">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex justify-center pb-2">
          <NewReservationAlert slug={slug} />
        </div>
        <div className="rounded-2xl bg-blush-lt p-3 text-[11px]">
          <div className="font-bold text-ink">{adminName}</div>
          <div className="mt-0.5 text-mute">관리자</div>
          <div className="mt-2 flex gap-2">
            <Link href={`/${slug}`} target="_blank" className="text-brand underline-offset-2 hover:underline">고객 화면 ↗</Link>
            <form action={logoutAdmin.bind(null, slug)}><button className="text-mute underline-offset-2 hover:underline">로그아웃</button></form>
          </div>
        </div>
      </aside>
      {/* 모바일 상단 탭 */}
      <div className="fixed inset-x-0 top-0 z-30 flex overflow-x-auto border-b border-line bg-card/95 px-2 backdrop-blur md:hidden">
        {NAV.map((n) => {
          const href = base + n.href;
          const on = n.href === "" ? path === base : path.startsWith(href);
          return (
            <Link key={n.href} href={href} className={cn("shrink-0 px-3 py-3 text-[12px] font-bold", on ? "border-b-2 border-brand text-brand" : "text-mute")}>{n.label}</Link>
          );
        })}
      </div>
      {/* 모바일은 사이드바가 없으므로 알림을 따로 띄운다 — 매장에선 폰으로 본다 */}
      <div className="fixed bottom-5 right-4 z-40 md:hidden">
        <NewReservationAlert slug={slug} />
      </div>
    </>
  );
}
