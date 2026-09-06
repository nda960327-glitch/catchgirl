"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Avatar, Button, Card, Empty, StatusChip } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import { cancelMyReservation } from "../actions";

export type HistoryItem = { id: string; code: string; status: string; startTime: string; endTime: string; hours: number; totalPrice: number; roomName: string | null; partySize: number; staffId: string; staffName: string; staffPhoto: string | null; hasReview: boolean };

export function HistoryTabs({ slug, items }: { slug: string; items: HistoryItem[] }) {
  const [tab, setTab] = useState<"upcoming" | "done" | "cancelled">("upcoming");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const groups = {
    upcoming: items.filter((i) => i.status === "CONFIRMED").sort((a, b) => a.startTime.localeCompare(b.startTime)),
    done: items.filter((i) => i.status === "COMPLETED" || i.status === "NOSHOW"),
    cancelled: items.filter((i) => i.status === "CANCELLED"),
  };
  const list = groups[tab];

  const cancel = (id: string) => {
    if (!confirm("예약을 취소할까요?")) return;
    start(async () => {
      const r = await cancelMyReservation(slug, id);
      toast(r.ok ? "예약을 취소했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });
  };

  return (
    <div className="mt-3">
      <div className="flex rounded-2xl bg-well-2 p-1">
        {([["upcoming", "예정"], ["done", "완료"], ["cancelled", "취소"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("flex-1 rounded-xl py-2 text-[12px] font-bold transition-all", tab === k ? "bg-card text-ink shadow-card" : "text-mute")}>
            {l} {groups[k].length > 0 && <span className={cn("ml-0.5", tab === k ? "text-brand" : "")}>{groups[k].length}</span>}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty sticker={tab === "upcoming" ? "p9" : "p2"} title={tab === "upcoming" ? "예정된 예약이 없어요" : "내역이 없어요"} desc={tab === "upcoming" ? "오늘 자리를 지키는 캐치걸를 만나보세요" : undefined} action={tab === "upcoming" ? <Link href={`/${slug}/bartenders`} className="rounded-full bg-blush-lt px-4 py-2 text-[12px] font-bold text-brand">캐치걸 보기</Link> : undefined} />
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {list.map((r) => {
            const d = new Date(r.startTime);
            return (
              <Card key={r.id} className="p-3.5 shadow-none">
                <div className="flex items-center gap-3">
                  <Link href={`/${slug}/bartenders/${r.staffId}`}>
                    <Avatar src={r.staffPhoto} name={r.staffName} size={46} rounded={15} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-bold text-ink">{r.staffName}</span>
                      <StatusChip status={r.status} />
                      {r.status === "CONFIRMED" && (
                        r.roomName ? (
                          <span className="rounded-full bg-brand px-2 py-[3px] text-[10px] font-bold text-white">{r.roomName}</span>
                        ) : (
                          <span className="rounded-full border border-dashed border-blush px-2 py-[3px] text-[10px] font-semibold text-mute">자리 안내 예정</span>
                        )
                      )}
                    </div>
                    <div className="mt-1 text-[12px] text-mute">
                      {format(d, "M월 d일 (EEE) HH:mm", { locale: ko })} ~ {format(new Date(r.endTime), "HH:mm")} · {r.hours}시간
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[10px] tracking-wider text-gold">NO. {r.code}</span>
                      <span className="text-[11px] font-semibold text-brand">{r.totalPrice.toLocaleString("ko-KR")}원</span>
                    </div>
                  </div>
                </div>
                {(r.status === "CONFIRMED" || (r.status === "COMPLETED" && !r.hasReview)) && (
                  <div className="mt-3 flex gap-2">
                    {r.status === "CONFIRMED" && (
                      <>
                        <Link href={`/${slug}/done/${r.id}`} className="flex h-9 flex-1 items-center justify-center rounded-xl bg-blush-lt text-[12px] font-bold text-brand">예약 상세</Link>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => cancel(r.id)} loading={pending}>취소하기</Button>
                      </>
                    )}
                    {r.status === "COMPLETED" && !r.hasReview && (
                      <Link href={`/${slug}/review/${r.id}`} className="cta-grad flex h-9 flex-1 items-center justify-center rounded-xl text-[12px] font-bold text-white">후기 쓰기</Link>
                    )}
                  </div>
                )}
                {r.status === "COMPLETED" && r.hasReview && <div className="mt-2 text-right text-[10px] text-mute">후기 작성 완료 ✓</div>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
