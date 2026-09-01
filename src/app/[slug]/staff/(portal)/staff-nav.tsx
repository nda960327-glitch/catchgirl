"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function StaffNav({ slug }: { slug: string }) {
  const path = usePathname();
  const base = `/${slug}/staff`;
  const tabs = [
    { href: base, label: "내 예약", on: path === base },
    { href: `${base}/earnings`, label: "내 매출", on: path.startsWith(`${base}/earnings`) },
    { href: `${base}/reviews`, label: "후기 · 댓글", on: path.startsWith(`${base}/reviews`) },
    { href: `${base}/settings`, label: "내 설정", on: path.startsWith(`${base}/settings`) },
  ];
  return (
    <div className="no-scrollbar flex gap-4 overflow-x-auto border-b border-line px-5">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={cn("-mb-px shrink-0 py-3 text-[13px] font-bold", t.on ? "border-b-2 border-brand text-ink" : "border-b-2 border-transparent text-mute")}>{t.label}</Link>
      ))}
    </div>
  );
}
