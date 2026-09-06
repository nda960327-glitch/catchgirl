"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ContactFab } from "@/components/contact-fab";

function useTabVisible(slug: string) {
  const path = usePathname();
  const base = `/${slug}`;
  const isDetail = new RegExp(`^${base}/bartenders/[^/]+$`).test(path);
  const hidden = path.startsWith(`${base}/book/`) || path.startsWith(`${base}/done/`) || isDetail || path.startsWith(`${base}/review/`);
  return { path, base, visible: !hidden };
}

/** 모바일 프레임 + 하단 탭바 (예약 플로우/상세에서는 탭바 숨김) */
export function CustomerShell({ slug, children, contact }: { slug: string; children: React.ReactNode; contact: { phone: string; telegram: string } }) {
  const { path, base, visible } = useTabVisible(slug);
  const tabs = [
    { l: "홈", href: base, on: path === base },
    { l: "예약", href: `${base}/bartenders`, on: path.startsWith(`${base}/bartenders`) || path.startsWith(`${base}/book`) },
    { l: "마이", href: `${base}/me`, on: path.startsWith(`${base}/me`) || path.startsWith(`${base}/login`) },
  ];
  return (
    <div className="phone-frame flex flex-col">
      <div className={cn("flex flex-1 flex-col overflow-y-auto", visible && "pb-[74px]")}>{children}</div>
      {/* 로그인 전에도 물어볼 수 있어야 한다 — 연결코드를 받으려면 매장에 연락해야 하므로 */}
      <ContactFab phone={contact.phone} telegram={contact.telegram} />
      {visible && (
        <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[66px] max-w-[430px] border-t border-line bg-white/95 backdrop-blur md:absolute md:max-w-none md:rounded-b-[28px]">
          {tabs.map((t) => (
            <Link key={t.l} href={t.href} className="flex flex-1 flex-col items-center justify-center gap-1.5">
              <span className={cn("h-[7px] w-[7px] rounded-full transition-colors", t.on ? "bg-brand" : "bg-[#DED2D4]")} />
              <span className={cn("text-[10px] font-semibold", t.on ? "text-brand" : "text-mute")}>{t.l}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
