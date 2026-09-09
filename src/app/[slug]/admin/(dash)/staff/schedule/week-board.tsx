"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, SHIFTS, toLocalDate, type Shift } from "@/lib/utils";
import { assignShift, copyDayAssignments } from "../../../actions";
import { useStaffLabel } from "@/components/store-label";

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Room = { id: string; name: string };
/** 누적 펑크 횟수까지 들고 온다 — 같은 자리에 또 넣기 전에 보이도록 */
type StaffLite = { id: string; name: string; available: { weekday: number; shift: string }[]; noshowCount: number };
type Assignment = { id: string; date: string; shift: string; roomId: string; staffId: string; startTime: string; endTime: string; isStandby: boolean };

/** "13:00" → "13", "13:30" → "13:30" — 칸이 좁아 정시는 시만 적는다 */
const shortTime = (t: string) => (t.endsWith(":00") ? t.slice(0, 2) : t);
const range = (a: string, b: string) => `${shortTime(a)}-${shortTime(b)}`;
const plusDays = (date: string, n: number) => {
  const t = toLocalDate(date, "00:00");
  t.setDate(t.getDate() + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

/**
 * 주간 배치표.
 *
 * 매장에서 쓰던 표와 같은 모양이다 — 세로는 룸(주간·야간 두 줄), 가로는 한 주.
 * 하루씩 넘겨 가며 짜면 "이 사람 이번 주에 몇 번 넣었더라" 를 알 수 없어서,
 * 한 판에 다 올려 놓고 채운다.
 */
export function WeekBoard({
  slug, today, weekStart, days, rooms, staff, assignments, presets,
}: {
  slug: string;
  today: string;
  weekStart: string;
  days: string[];
  rooms: Room[];
  staff: StaffLite[];
  assignments: Assignment[];
  presets: { DAY: { start: string; end: string }; NIGHT: { start: string; end: string } };
}) {
  const staffLabel = useStaffLabel();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [cell, setCell] = useState<{ date: string; shift: Shift; room: Room } | null>(null);

  const at = (date: string, shift: Shift, roomId: string) =>
    assignments.find((a) => a.date === date && a.shift === shift && a.roomId === roomId);
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? "—";
  // 이번 주에 몇 번 들어갔는지 — 한 사람에게 몰리는 걸 고르면서 바로 본다
  const countIn = (staffId: string) => assignments.filter((a) => days.includes(a.date) && a.staffId === staffId && !a.isStandby).length;

  const save = (date: string, shift: Shift, roomId: string, staffId: string, times?: { startTime: string; endTime: string; isStandby?: boolean }) =>
    start(async () => {
      const r = await assignShift(slug, { date, shift, roomId, staffId, ...times });
      if (!r.ok) return toast(r.error, "error");
      router.refresh();
    });

  const copyLastWeek = () =>
    start(async () => {
      if (!confirm("지난주 배치를 이번 주로 그대로 가져올까요? 지금 이번 주에 넣어 둔 배치는 지워집니다.")) return;
      let n = 0;
      for (const d of days) {
        const r = await copyDayAssignments(slug, plusDays(d, -7), d);
        if (r.ok) n += r.data?.count ?? 0;
      }
      toast(`${n}건 가져왔어요`, "success");
      router.refresh();
    });

  const filled = assignments.filter((a) => days.includes(a.date) && !a.isStandby).length;
  const standby = assignments.filter((a) => days.includes(a.date) && a.isStandby).length;

  return (
    <>
      <Card className="mt-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push(`?date=${plusDays(weekStart, -7)}`)}>‹ 지난주</Button>
          <span className="text-[13px] font-bold text-ink">
            {days[0].slice(5).replace("-", "/")} ~ {days[6].slice(5).replace("-", "/")}
          </span>
          <Button size="sm" variant="outline" onClick={() => router.push(`?date=${plusDays(weekStart, 7)}`)}>다음주 ›</Button>
          <Chip tone="mute">{filled}칸 채움</Chip>
          {standby > 0 && <Chip tone="gold">예비 {standby}</Chip>}
          <Button size="sm" variant="secondary" className="ml-auto" onClick={copyLastWeek} loading={pending}>
            지난주 그대로 가져오기
          </Button>
        </div>
      </Card>

      <Card className="mt-3 overflow-hidden">
        <div className="scroll-x overflow-x-auto pb-2">
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-[88px] bg-well px-2 py-2 text-left text-[11px] font-semibold text-mute">객실</th>
                <th className="w-[86px] bg-well px-1 py-2 text-left text-[11px] font-semibold text-mute">근무 시간</th>
                {days.map((d) => {
                  const wd = toLocalDate(d, "00:00").getDay();
                  return (
                    <th
                      key={d}
                      className={cn(
                        "bg-well px-1 py-2 text-center text-[11px] font-bold",
                        d === today ? "text-brand" : wd === 0 ? "text-bad" : "text-mute",
                      )}
                    >
                      {d.slice(5).replace("-", "/")} ({WEEKDAYS[wd]})
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) =>
                SHIFTS.map(([shift, label], si) => (
                  <tr key={`${room.id}-${shift}`}>
                    {si === 0 && (
                      <td rowSpan={2} className="sticky left-0 z-10 border-t border-line bg-card px-2 py-1 align-middle font-bold text-ink">
                        {room.name}
                      </td>
                    )}
                    <td className={cn("border-t px-1 py-1 text-[10px] font-semibold", si === 0 ? "border-line" : "border-line/40")}>
                      <span className={cn("rounded px-1 py-0.5", shift === "DAY" ? "bg-day-bg text-day" : "bg-night-bg text-night")}>
                        {label} {range(presets[shift].start, presets[shift].end)}
                      </span>
                    </td>
                    {days.map((d) => {
                      const a = at(d, shift, room.id);
                      return (
                        <td
                          key={d}
                          className={cn("p-0.5", si === 0 ? "border-t border-line" : "border-t border-line/40", d === today && "bg-blush-lt/25")}
                        >
                          <button
                            onClick={() => setCell({ date: d, shift, room })}
                            disabled={pending}
                            className={cn(
                              "flex h-9 w-full items-center justify-center rounded-md px-1 text-[11px] font-bold transition-colors",
                              a
                                ? a.isStandby
                                  ? "border border-dashed border-gold/70 bg-card text-day hover:bg-well"
                                  : shift === "DAY"
                                    ? "bg-day-bg text-day hover:brightness-95"
                                    : "bg-night-bg text-night hover:brightness-95"
                                : "border border-dashed border-line text-mute/40 hover:border-brand hover:text-brand",
                            )}
                          >
                            {a ? (
                              <span className="truncate">
                                {nameOf(a.staffId)}{" "}
                                <span className="font-semibold opacity-70">{a.isStandby ? "예비" : range(a.startTime, a.endTime)}</span>
                              </span>
                            ) : (
                              "+"
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {cell && (
        <CellEditor
          key={`${cell.date}-${cell.shift}-${cell.room.id}`}
          cell={cell}
          staff={staff}
          current={at(cell.date, cell.shift, cell.room.id)}
          preset={presets[cell.shift]}
          takenInShift={assignments.filter((a) => a.date === cell.date && a.shift === cell.shift).map((a) => a.staffId)}
          countIn={countIn}
          pending={pending}
          onClose={() => setCell(null)}
          onSave={(staffId, times) => {
            save(cell.date, cell.shift, cell.room.id, staffId, times);
            setCell(null);
          }}
        />
      )}
    </>
  );
}

function CellEditor({
  cell, staff, current, preset, takenInShift, countIn, pending, onClose, onSave,
}: {
  cell: { date: string; shift: Shift; room: Room };
  staff: StaffLite[];
  current?: Assignment;
  preset: { start: string; end: string };
  takenInShift: string[];
  countIn: (id: string) => number;
  pending: boolean;
  onClose: () => void;
  onSave: (staffId: string, times?: { startTime: string; endTime: string; isStandby?: boolean }) => void;
}) {
  const staffLabel = useStaffLabel();
  const [staffId, setStaffId] = useState(current?.staffId ?? "");
  const [startTime, setStartTime] = useState(current?.startTime ?? preset.start);
  const [endTime, setEndTime] = useState(current?.endTime ?? preset.end);
  const [standby, setStandby] = useState(current?.isStandby ?? false);

  const weekday = toLocalDate(cell.date, "00:00").getDay();
  const canWork = (s: StaffLite) => s.available.some((a) => a.weekday === weekday && a.shift === cell.shift);
  const canWorkOther = (s: StaffLite) => !canWork(s) && s.available.some((a) => a.weekday === weekday);
  const label = SHIFTS.find(([sh]) => sh === cell.shift)?.[1] ?? cell.shift;
  const taken = new Set(takenInShift);

  const option = (s: StaffLite) => (
    <option key={s.id} value={s.id}>
      {s.name}
      {taken.has(s.id) && s.id !== current?.staffId ? " (다른 룸)" : ""}
      {` · 이번 주 ${countIn(s.id)}회`}
      {s.noshowCount > 0 ? ` · 펑크 ${s.noshowCount}회` : ""}
    </option>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-[28px] bg-paper p-6 shadow-pop md:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-serif text-[17px] font-bold text-ink">{cell.room.name}</div>
            <div className="mt-0.5 text-[11px] text-mute">
              {cell.date.slice(5)} ({WEEKDAYS[weekday]}) · {label}조
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 shrink-0 rounded-full border border-line bg-card text-mute">✕</button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <label className="block text-[11px] font-semibold text-mute">
            {staffLabel}
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="mt-1 h-11 w-full text-[13px]">
              <option value="">— 비우기 —</option>
              <optgroup label={`이 요일 ${label}조 가능`}>{staff.filter(canWork).map(option)}</optgroup>
              <optgroup label="다른 조만 가능">{staff.filter(canWorkOther).map(option)}</optgroup>
              <optgroup label="가능 표시 없음">{staff.filter((s) => !canWork(s) && !canWorkOther(s)).map(option)}</optgroup>
            </Select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] font-semibold text-mute">
              시작
              <Select value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 h-11 w-full text-[13px]">
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </label>
            <label className="block text-[11px] font-semibold text-mute">
              종료
              <Select value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 h-11 w-full text-[13px]">
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </label>
          </div>
          <div className="text-[10px] leading-[1.7] text-mute">
            {label}조 기본은 {range(preset.start, preset.end)} 예요. 사람마다 다르면 여기서 고치시면 돼요.
          </div>

          {/* 예비는 자리를 잡아 두는 표시일 뿐 실제 근무가 아니다 — 예약을 받지 않는다 */}
          <button
            type="button"
            aria-pressed={standby}
            onClick={() => setStandby((v) => !v)}
            className={cn(
              "flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-left transition-colors",
              standby ? "border-gold bg-well" : "border-line bg-card hover:border-gold/60",
            )}
          >
            <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold", standby ? "border-gold bg-gold text-white" : "border-line bg-card text-transparent")}>✓</span>
            <span className="min-w-0">
              <span className="block text-[12px] font-bold text-ink">예비로 걸어두기</span>
              <span className="mt-0.5 block text-[10px] leading-[1.7] text-mute">
                자리는 잡아 두되 손님 예약은 열리지 않아요. 근무가 확정되면 체크를 풀어 주세요.
              </span>
            </span>
          </button>
        </div>

        <div className="mt-5 flex gap-2">
          <Button className="flex-1" loading={pending} onClick={() => onSave(staffId, { startTime, endTime, isStandby: standby })}>
            {staffId ? (standby ? "예비로 저장" : "저장") : "이 칸 비우기"}
          </Button>
          <Button variant="ghost" onClick={onClose}>취소</Button>
        </div>
      </div>
    </div>
  );
}
