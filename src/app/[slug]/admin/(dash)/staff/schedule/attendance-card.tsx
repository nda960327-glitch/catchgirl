"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Chip } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, SHIFT_LABEL } from "@/lib/utils";
import { setAttendance } from "../../../actions";
import { useStaffLabel } from "@/components/store-label";
import { josa } from "@/lib/labels";

export type AttendanceRow = {
  id: string;
  roomName: string;
  shift: string;
  staffId: string;
  staffName: string;
  startTime: string;
  endTime: string;
  attendance: string;
  note: string;
  /** 이 사람의 그날 예약 건수 — 펑크나면 이만큼이 문제가 된다 */
  bookings: number;
  /** 전체 기간 펑크 횟수 */
  noshowCount: number;
};

const MARKS = [
  { key: "PRESENT", label: "출근", tone: "bg-ok text-white", ring: "border-ok" },
  { key: "LATE", label: "지각", tone: "bg-gold text-white", ring: "border-gold" },
  { key: "NOSHOW", label: "펑크", tone: "bg-bad text-white", ring: "border-bad" },
  { key: "EXCUSED", label: "사전연락", tone: "bg-ink text-on-ink", ring: "border-ink" },
] as const;

/**
 * 출근 체크.
 *
 * 배치는 계획일 뿐이라 그날 안 나오면 방이 빈다. 손님 예약이 걸려 있으면
 * 그게 곧 사고이므로, 표시하면서 몇 건이 물려 있는지 같이 보여 준다.
 */
export function AttendanceCard({ slug, date, rows }: { slug: string; date: string; rows: AttendanceRow[] }) {
  const staffLabel = useStaffLabel();
  const [pending, start] = useTransition();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const mark = (id: string, next: string, note?: string) =>
    start(async () => {
      const r = await setAttendance(slug, id, next as "PRESENT", note);
      if (!r.ok) return toast(r.error, "error");
      router.refresh();
    });

  if (rows.length === 0) {
    return (
      <Card className="mt-4 py-10 text-center text-[13px] text-mute">이 날은 배치된 사람이 없어요</Card>
    );
  }

  const done = rows.filter((r) => r.attendance !== "PLANNED").length;
  const noshow = rows.filter((r) => r.attendance === "NOSHOW").length;
  const affected = rows.filter((r) => r.attendance === "NOSHOW").reduce((a, r) => a + r.bookings, 0);

  return (
    <Card className="mt-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-bold text-ink">출근 체크</span>
        <Chip tone="mute">{done}/{rows.length} 확인</Chip>
        {noshow > 0 && <Chip tone="red">펑크 {noshow}명</Chip>}
        <span className="ml-auto text-[10px] text-mute">눌러서 바로 저장돼요</span>
      </div>

      {affected > 0 && (
        <div className="mt-2.5 rounded-2xl border border-bad/25 bg-bad-bg px-4 py-2.5 text-[11px] leading-[1.7] text-ink">
          펑크난 자리에 <b>예약 {affected}건</b>이 걸려 있어요. 다른 {josa(staffLabel, "으로")} 옮기거나 손님께 미리 연락해 주세요.
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1.5">
        {rows.map((r) => {
          const isNoshow = r.attendance === "NOSHOW";
          return (
            <div
              key={r.id}
              className={cn(
                "rounded-2xl border px-3 py-2.5",
                isNoshow ? "border-bad/30 bg-bad-bg" : r.attendance === "PLANNED" ? "border-line bg-card" : "border-line bg-ok-bg",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("w-[44px] shrink-0 rounded-md px-1 py-0.5 text-center text-[10px] font-bold", r.shift === "DAY" ? "bg-day-bg text-day" : "bg-night-bg text-night")}>
                  {SHIFT_LABEL[r.shift] ?? r.shift}
                </span>
                <span className="w-[62px] shrink-0 text-[12px] font-bold text-ink">{r.roomName}</span>
                <span className="text-[12px] font-bold text-ink">{r.staffName}</span>
                <span className="text-[11px] text-mute">{r.startTime}~{r.endTime}</span>
                {r.bookings > 0 && <span className="text-[10px] font-semibold text-brand">예약 {r.bookings}건</span>}
                {r.noshowCount > 0 && <span className="text-[10px] text-mute">누적 펑크 {r.noshowCount}회</span>}

                <div className="ml-auto flex gap-1">
                  {MARKS.map((m) => {
                    const on = r.attendance === m.key;
                    return (
                      <button
                        key={m.key}
                        disabled={pending}
                        aria-pressed={on}
                        onClick={() => mark(r.id, on ? "PLANNED" : m.key)}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors disabled:opacity-40",
                          on ? `${m.tone} ${m.ring}` : "border-line bg-card text-mute hover:border-brand hover:text-brand",
                        )}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(r.note || noteFor === r.id) && (
                <div className="mt-2">
                  {noteFor === r.id ? (
                    <input
                      autoFocus
                      defaultValue={r.note}
                      maxLength={200}
                      placeholder="사유를 적어 두세요 (매장만 봐요)"
                      onBlur={(e) => { mark(r.id, r.attendance, e.target.value); setNoteFor(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="h-9 w-full rounded-xl border border-line px-3 text-[12px] outline-none focus:border-brand"
                    />
                  ) : (
                    <button onClick={() => setNoteFor(r.id)} className="text-[11px] text-mute underline-offset-2 hover:underline">
                      {r.note}
                    </button>
                  )}
                </div>
              )}
              {!r.note && noteFor !== r.id && r.attendance !== "PLANNED" && (
                <button onClick={() => setNoteFor(r.id)} className="mt-1 text-[10px] text-mute underline-offset-2 hover:underline">
                  + 사유 적기
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
