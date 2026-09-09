"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar, Chip } from "@/components/ui";
import { cn, STATUS_LABEL } from "@/lib/utils";
import { useStaffLabel } from "@/components/store-label";

export type TimelineItem = {
  id: string;
  code: string;
  time: string; // 시작 HH:mm
  endTime: string; // 종료 HH:mm
  hours: number;
  status: string;
  requestNote: string;
  totalPrice: number;
  optionNames: string[];
  createdBy: string;
  customerId: string;
  customer: string;
  customerMemo: string;
  customerVisits: number;
  customerNoshows: number;
  blacklisted: boolean;
};
export type TimelineRow = { id: string; name: string; photo: string | null; items: TimelineItem[] };

// 12:00~익일 04:00 = 32칸이라, 칸을 좁혀야 새벽 시간대까지 한 화면에 들어온다
const COL = 38;
const NAME_W = 96;
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 간트 차트형 타임라인: 행 = 캐치걸, 열 = 슬롯.
 *  예약은 [시작, 종료) 구간을 차지하므로 칸 하나가 아니라 실제 길이만큼 늘려 그린다. */
export function Timeline({
  slug, times, slotMinutes, rows, nowTime,
}: {
  slug: string;
  times: string[];
  slotMinutes: number;
  rows: TimelineRow[];
  nowTime: string;
}) {
  const [picked, setPicked] = useState<{ item: TimelineItem; staffName: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // "02:09" < "12:00" 이라 문자열로 비교하면 새벽엔 지금 표시가 낮 12시로 튄다.
  // 영업일은 자정을 넘겨 이어지므로 오픈 시각보다 이른 시간은 다음 날로 펴서 센다.
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const openMin = toMin(times[0] ?? "00:00");
  const norm = (t: string) => (toMin(t) < openMin ? toMin(t) + 24 * 60 : toMin(t));
  const nowIdx = times.findIndex((t) => norm(t) > norm(nowTime));
  const perHour = 60 / slotMinutes;

  // scrollTo({behavior:"smooth"}) 를 무시하는 브라우저가 있어 scrollLeft 로 직접 옮긴다.
  // 부드럽게 흐르는 건 컨테이너의 scroll-smooth 가 맡는다.
  /** 새벽까지 다 그리면 화면 밖으로 넘어가므로, 열 때 지금 시각이 보이는 곳으로 옮겨 둔다 */
  const scrollToNow = () => {
    const el = scroller.current;
    if (!el || nowIdx < 0) return;
    el.scrollLeft = Math.max(0, nowIdx * COL - el.clientWidth / 3);
  };
  useEffect(scrollToNow, [nowIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const nudge = (dir: -1 | 1) => {
    const el = scroller.current;
    if (el) el.scrollLeft += dir * COL * perHour * 3;
  };

  return (
    <>
      <div className="mt-4 flex items-center justify-end gap-1.5">
        <button onClick={() => nudge(-1)} aria-label="이전 시간대" className="h-8 w-8 rounded-xl border border-line bg-card text-[13px] font-bold text-mute hover:border-brand hover:text-brand">‹</button>
        <button onClick={scrollToNow} className="h-8 rounded-xl border border-line bg-card px-3 text-[11px] font-bold text-mute hover:border-brand hover:text-brand">지금</button>
        <button onClick={() => nudge(1)} aria-label="다음 시간대" className="h-8 w-8 rounded-xl border border-line bg-card text-[13px] font-bold text-mute hover:border-brand hover:text-brand">›</button>
      </div>
      {/* scroll-behavior:smooth 를 켜면 일부 브라우저에서 scrollLeft 지정이 통째로 무시된다 */}
      <div ref={scroller} className="scroll-x mt-2 overflow-x-auto pb-2">
        <div style={{ minWidth: NAME_W + times.length * COL }}>
          <div className="flex">
            {/* 옆으로 밀어도 누구 줄인지 보여야 하므로 이름 칸은 붙여 둔다 */}
            <div className="sticky left-0 z-20 shrink-0 bg-card" style={{ width: NAME_W }} />
            {times.map((t, i) => (
              <div
                key={t}
                className={cn("shrink-0 text-center text-[10px]", i === nowIdx ? "font-bold text-brand" : "text-mute")}
                style={{ width: COL }}
              >
                {/* 30분 칸마다 다 적으면 겹치니 정시에만 표시 */}
                {i % perHour === 0 ? t : ""}
              </div>
            ))}
          </div>

          {rows.map((row) => (
            <div key={row.id} className="mt-2 flex items-center">
              <div className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 bg-card pr-2" style={{ width: NAME_W }}>
                <Avatar src={row.photo} name={row.name} size={26} rounded={9} />
                <span className="truncate text-[12px] font-bold text-ink">{row.name}</span>
              </div>

              {/* 빈 격자 위에 예약 블록을 절대 배치 */}
              <div className="relative h-10 shrink-0" style={{ width: times.length * COL }}>
                {times.map((t, i) => (
                  <div
                    key={t}
                    className={cn(
                      "absolute inset-y-0",
                      // 정시 경계는 진하게, 30분은 흐리게 — 칸이 좁아도 시간을 읽을 수 있게
                      i % perHour === 0 ? "border-l border-line" : "border-l border-line/40",
                      i === nowIdx && "bg-blush-lt/40",
                    )}
                    style={{ left: i * COL, width: COL }}
                  />
                ))}
                {row.items.map((it) => {
                  const start = times.indexOf(it.time);
                  if (start < 0) return null; // 영업시간 밖 (설정 변경 전 예약)
                  const span = Math.min(it.hours * perHour, times.length - start);
                  return (
                    <button
                      key={it.id}
                      onClick={() => setPicked({ item: it, staffName: row.name })}
                      title={`${it.customer} · ${it.time}~${it.endTime}`}
                      className={cn(
                        "absolute inset-y-1 flex items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-bold leading-tight transition-transform hover:z-10 hover:scale-[1.02]",
                        it.status === "CONFIRMED" && "bg-brand text-white",
                        it.status === "COMPLETED" && "bg-ok-bg text-ok",
                        it.status === "NOSHOW" && "bg-bad-bg text-bad",
                      )}
                      style={{ left: start * COL + 2, width: span * COL - 4 }}
                    >
                      <span className="truncate">{it.customer}</span>
                      {span >= 4 && <span className="opacity-80">{it.hours}h</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {picked && <DetailModal slug={slug} item={picked.item} staffName={picked.staffName} onClose={() => setPicked(null)} />}
    </>
  );
}

function DetailModal({ slug, item, staffName, onClose }: { slug: string; item: TimelineItem; staffName: string; onClose: () => void }) {
  const staffLabel = useStaffLabel();
  const grade = item.customerVisits >= 10 ? "VIP" : item.customerVisits >= 5 ? "단골" : "신규";
  const rows: [string, string][] = [
    ["예약번호", item.code],
    ["시간", `${item.time} ~ ${item.endTime} (${item.hours}시간)`],
    [staffLabel, staffName],
    ["금액", won(item.totalPrice)],
    ...(item.optionNames.length ? ([["옵션", item.optionNames.join(", ")]] as [string, string][]) : []),
    ["등록", item.createdBy === "ADMIN" ? "관리자(전화)" : "고객 앱"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-paper p-6 shadow-pop md:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-serif text-[20px] font-bold text-ink">{item.customer}</span>
              <Chip>{grade}</Chip>
              {item.blacklisted && <Chip tone="red">블랙리스트</Chip>}
              {item.customerNoshows >= 3 && <Chip tone="red">노쇼 {item.customerNoshows}회</Chip>}
            </div>
            <div className="mt-1 text-[11px] text-mute">
              방문 {item.customerVisits}회 · 노쇼 {item.customerNoshows}회
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 shrink-0 rounded-full border border-line bg-card text-mute">✕</button>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-card px-4 py-1">
          {rows.map(([k, v], i) => (
            <div key={k} className={cn("flex justify-between py-2.5 text-[12px]", i && "border-t border-line")}>
              <span className="text-mute">{k}</span>
              <span className="font-semibold text-ink">{v}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div className="rounded-2xl bg-well px-4 py-3">
            <div className="text-[11px] font-semibold text-mute">요청사항</div>
            <div className="mt-1 text-[12px] leading-[1.7] text-ink">{item.requestNote || "—"}</div>
          </div>
          <div className="rounded-2xl bg-blush-lt/60 px-4 py-3">
            <div className="text-[11px] font-semibold text-brand">고정 메모 (고객에겐 안 보임)</div>
            <div className="mt-1 text-[12px] leading-[1.7] text-ink">{item.customerMemo || "—"}</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Link href={`/${slug}/admin/customers/${item.customerId}`} className="flex-1 rounded-2xl bg-brand py-3 text-center text-[13px] font-bold text-white">고객 상세 보기</Link>
          <Link href={`/${slug}/admin/reservations?view=list&focus=${item.id}`} className="flex-1 rounded-2xl border border-line bg-card py-3 text-center text-[13px] font-bold text-ink">예약 관리로</Link>
        </div>
        <div className="mt-2 text-center text-[11px] text-mute">현재 상태 · {STATUS_LABEL[item.status] ?? item.status}</div>
      </div>
    </div>
  );
}
