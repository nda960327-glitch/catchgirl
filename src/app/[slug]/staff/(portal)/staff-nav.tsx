"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function StaffNav({ slug }: { slug: string }) {
  const path = usePathname();
  const base = `/${slug}/staff`;
  const tabs = [
    { href: base, label: "내 예약 캘린더", on: path === base },
    { href: `${base}/reviews`, label: "후기 · 댓글", on: path.startsWith(`${base}/reviews`) },
  ];
  return (
    <div className="flex gap-5 border-b border-line px-5">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={cn("-mb-px py-3 text-[13px] font-bold", t.on ? "border-b-2 border-brand text-ink" : "border-b-2 border-transparent text-mute")}>{t.label}</Link>
      ))}
    </div>
  );
}
