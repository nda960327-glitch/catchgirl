"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import { unblock } from "@/app/[slug]/report-actions";

export type BlockedItem = { id: string; name: string; createdAt: string };

/** 내가 차단한 사람 목록 — 손님 마이페이지와 직원 내 설정에서 같이 쓴다 */
export function BlockedList({
  slug, role, items, title, desc, className,
}: {
  slug: string;
  role: "customer" | "staff";
  items: BlockedItem[];
  title: string;
  desc: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const release = (id: string, name: string) =>
    start(async () => {
      const r = await unblock(slug, role, id);
      toast(r.ok ? `${name}님 차단을 풀었어요` : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  return (
    <section className={cn("rounded-[20px] border border-line bg-card p-4", className)}>
      <div className="text-[12px] font-bold text-ink">{title}</div>
      <p className="mt-1 text-[11px] leading-[1.7] text-mute">{desc}</p>
      {items.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-line px-4 py-3.5 text-center text-[11px] text-mute">차단한 사람이 없어요</div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {items.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-well px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-bold text-ink">{b.name}</div>
                <div className="text-[10px] text-mute">{b.createdAt.slice(0, 10).replace(/-/g, ".")} 차단</div>
              </div>
              <Button size="sm" variant="outline" loading={pending} onClick={() => release(b.id, b.name)}>차단 풀기</Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
