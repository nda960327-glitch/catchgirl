"use client";

import { useEffect, useState } from "react";
import { Card, Chip } from "@/components/ui";
import { cn, SHIFT_LABEL, won } from "@/lib/utils";
import { useStaffLabel } from "@/components/store-label";

export type CollectRow = {
  id: string;
  code: string;
  room: string;
  shift: string;
  time: string;
  endTime: string;
  hours: number;
  staffName: string;
  customerName: string;
  fee: number;
  discount: number;
  discountLabel: string;
  collect: number;
  status: string;
};

/**
 * 룸을 돌며 걷는 순서대로 보여준다.
 *
 * 받은 방은 체크해 두어야 두 번 가지 않는다. 그날 저녁 한 사람이 한 기기로
 * 도는 일이라 브라우저에 저장하는 걸로 충분하고, 저장이 막혀 있어도
 * (시크릿 모드 등) 화면은 그대로 동작해야 한다.
 */
export function CollectSheet({ date, rows }: { date: string; rows: CollectRow[] }) {
  const staffLabel = useStaffLabel();
  const key = `collect-done-${date}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setDone(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setDone(new Set());
    }
    setReady(true);
  }, [key]);

  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
      /* 저장 못 해도 이번 화면에서는 체크가 유지된다 */
    }
  };

  // 룸 번호 순으로 — 실제로 도는 순서와 같게
  const roomsInOrder = [...new Set(rows.map((r) => r.room))].sort((a, b) => {
    const na = Number(a.match(/\d+/)?.[0] ?? 9999);
    const nb = Number(b.match(/\d+/)?.[0] ?? 9999);
    return na - nb || a.localeCompare(b);
  });

  const left = rows.filter((r) => !done.has(r.id)).reduce((a, r) => a + r.collect, 0);
  const gotAmount = rows.filter((r) => done.has(r.id)).reduce((a, r) => a + r.collect, 0);

  if (rows.length === 0) {
    return (
      <Card className="mt-4 py-12 text-center text-[13px] text-mute">이 날은 받을 예약이 없어요</Card>
    );
  }

  return (
    <>
      {ready && done.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-ok-bg px-4 py-3 text-[12px]">
          <span className="font-bold text-ok">받음 {won(gotAmount)}</span>
          <span className="text-mute">·</span>
          <span className="font-bold text-ink">남음 {won(left)}</span>
          <button
            onClick={() => {
              setDone(new Set());
              try { localStorage.removeItem(key); } catch { /* 무시 */ }
            }}
            className="ml-auto text-[11px] font-bold text-mute underline-offset-2 hover:underline"
          >
            체크 지우기
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {roomsInOrder.map((room) => {
          const inRoom = rows.filter((r) => r.room === room);
          const roomTotal = inRoom.reduce((a, r) => a + r.collect, 0);
          const roomLeft = inRoom.filter((r) => !done.has(r.id)).reduce((a, r) => a + r.collect, 0);
          const allDone = roomLeft === 0;
          return (
            <Card key={room} className={cn("overflow-hidden", allDone && ready && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-well px-4 py-2.5">
                <span className="font-serif text-[15px] font-bold text-ink">{room}</span>
                {allDone && ready && <Chip tone="green">수금 완료</Chip>}
                <span className="ml-auto font-serif text-[16px] font-bold text-brand">{won(roomTotal)}</span>
              </div>
              <div className="divide-y divide-line">
                {inRoom.map((r) => {
                  const on = done.has(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggle(r.id)}
                      aria-pressed={on}
                      className={cn("flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left text-[12px] transition-colors", on ? "bg-ok-bg" : "hover:bg-blush-lt/30")}
                    >
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold", on ? "border-ok bg-ok text-white" : "border-line bg-card text-transparent")}>
                        ✓
                      </span>
                      <span className={cn("w-[42px] shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold", r.shift === "DAY" ? "bg-day-bg text-day" : "bg-night-bg text-night")}>
                        {SHIFT_LABEL[r.shift] ?? r.shift}
                      </span>
                      <span className="w-[86px] shrink-0 font-semibold text-ink">{r.time}~{r.endTime}</span>
                      <span className="w-[52px] shrink-0 text-mute">{r.hours}시간</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-bold text-ink">{r.staffName}</span>
                        <span className="text-mute"> · {r.customerName}</span>
                        {r.discount > 0 && (
                          <span className="block text-[10px] text-brand">{r.discountLabel} −{won(Math.min(r.fee, r.discount))}</span>
                        )}
                      </span>
                      <span className={cn("shrink-0 font-serif text-[15px] font-bold", on ? "text-ok line-through" : "text-ink")}>
                        {won(r.collect)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-3 px-1 text-[10px] leading-[1.8] text-mute">
        받은 방은 눌러서 체크해 두세요. 이 기기에만 저장되고 날짜가 바뀌면 새로 시작해요.
        <br />
        할인은 매장이 부담한 금액이라 받을 돈에서 빠져 있어요. {staffLabel}에게 줄 몫은 정가 기준 그대로예요.
      </div>
    </>
  );
}
