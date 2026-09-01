"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Avatar, Button, Card, Chip, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, toLocalDate, SHIFTS, SHIFT_LABEL, type Shift } from "@/lib/utils";
import { assignShift, clearDayAssignments, copyDayAssignments } from "../../../actions";

type Room = { id: string; name: string };
type StaffLite = { id: string; name: string; photo: string | null };
type Assignment = { id: string; date: string; shift: string; roomId: string; staffId: string };
type TimeOff = { id: string; staffId: string; date: string; startTime: string; endTime: string; reason: string; createdBy: string };

export function ScheduleBoard({
  slug, today, date, days, rooms, staff, assignments, timeOffs,
}: {
  slug: string;
  today: string;
  date: string;
  days: string[];
  rooms: Room[];
  staff: StaffLite[];
  assignments: Assignment[];
  timeOffs: TimeOff[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [copyFrom, setCopyFrom] = useState("");

  const dayOf = (d: string) => assignments.filter((a) => a.date === d);
  const cur = dayOf(date);
  const at = (shift: Shift, roomId: string) => cur.find((a) => a.shift === shift && a.roomId === roomId)?.staffId ?? "";
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "—";

  // 이 조에 이미 다른 룸을 맡은 사람은 드롭다운에서 흐리게 (선택하면 방을 옮긴다)
  const takenIn = (shift: Shift) => new Set(cur.filter((a) => a.shift === shift).map((a) => a.staffId));
  const offToday = timeOffs.filter((t) => t.date === date);
  const offOf = (staffId: string) => offToday.filter((t) => t.staffId === staffId);

  const setCell = (shift: Shift, roomId: string, staffId: string) =>
    start(async () => {
      const r = await assignShift(slug, { date, shift, roomId, staffId });
      if (!r.ok) return toast(r.error, "error");
      router.refresh();
    });

  const doCopy = () =>
    start(async () => {
      if (!copyFrom) return;
      if (!confirm(`${copyFrom} 배치를 ${date}(으)로 복사할까요?\n지금 ${date} 배치는 지워집니다.`)) return;
      const r = await copyDayAssignments(slug, copyFrom, date);
      if (!r.ok) return toast(r.error, "error");
      toast(`${r.data?.count}건 복사했어요`, "success");
      router.refresh();
    });

  const doClear = () =>
    start(async () => {
      if (!confirm(`${date} 배치를 전부 비울까요?`)) return;
      const r = await clearDayAssignments(slug, date);
      if (!r.ok) return toast(r.error, "error");
      toast("비웠어요", "success");
      router.refresh();
    });

  const assignedCount = (d: string) => dayOf(d).length;

  return (
    <>
      {/* 2주 날짜 선택 */}
      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => {
          const dt = toLocalDate(d, "00:00");
          const on = d === date;
          const n = assignedCount(d);
          return (
            <Link
              key={d}
              href={`?date=${d}`}
              scroll={false}
              className={cn(
                "flex min-w-[68px] shrink-0 flex-col items-center rounded-2xl border px-2 py-2 transition-colors",
                on ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand",
              )}
            >
              <span className={cn("text-[10px]", on ? "opacity-80" : dt.getDay() === 0 ? "text-brand" : "text-mute")}>
                {format(dt, "EEE", { locale: ko })}
              </span>
              <span className="font-serif text-[16px] font-bold">{dt.getDate()}</span>
              <span className={cn("text-[9px]", on ? "opacity-85" : n > 0 ? "text-brand" : "text-mute")}>{n > 0 ? `${n}명` : "미편성"}</span>
              {d === today && <span className={cn("text-[8px] font-bold", on ? "opacity-90" : "text-gold")}>오늘</span>}
            </Link>
          );
        })}
      </div>

      {/* 도구 */}
      <Card className="mt-3 flex flex-wrap items-center gap-2 p-3">
        <span className="text-[12px] font-bold text-ink">{format(toLocalDate(date, "00:00"), "M월 d일 (EEE)", { locale: ko })}</span>
        <Chip tone={cur.length ? "brand" : "mute"}>{cur.length}명 배치</Chip>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="h-9 text-[12px]">
            <option value="">다른 날 배치 복사…</option>
            {days.filter((d) => d !== date && assignedCount(d) > 0).map((d) => (
              <option key={d} value={d}>{format(toLocalDate(d, "00:00"), "M/d (EEE)", { locale: ko })} · {assignedCount(d)}명</option>
            ))}
          </Select>
          <Button size="sm" variant="secondary" onClick={doCopy} loading={pending} disabled={!copyFrom}>복사</Button>
          <button onClick={doClear} disabled={pending || cur.length === 0} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-bold text-mute hover:text-[#C0392B] disabled:opacity-40">비우기</button>
        </div>
      </Card>

      {/* 룸 × 조 배치 */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {SHIFTS.map(([shift, label]) => {
          const taken = takenIn(shift);
          const filled = cur.filter((a) => a.shift === shift).length;
          return (
            <Card key={shift} className="p-4">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", shift === "DAY" ? "bg-gold" : "bg-ink")} />
                <span className="text-[13px] font-bold text-ink">{label}조</span>
                <Chip tone="mute">{filled}/{rooms.length}</Chip>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {rooms.map((room) => {
                  const sid = at(shift, room.id);
                  const offs = sid ? offOf(sid) : [];
                  return (
                    <div key={room.id} className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-2", sid ? "border-line bg-white" : "border-dashed border-line bg-[#FAF6F7]")}>
                      <span className="w-[58px] shrink-0 text-[12px] font-bold text-ink">{room.name}</span>
                      {sid && <Avatar src={staff.find((s) => s.id === sid)?.photo ?? null} name={staffName(sid)} size={22} rounded={7} />}
                      <Select
                        value={sid}
                        disabled={pending}
                        onChange={(e) => setCell(shift, room.id, e.target.value)}
                        className="h-9 min-w-0 flex-1 text-[12px]"
                      >
                        <option value="">— 비어 있음 —</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}{taken.has(s.id) && s.id !== sid ? " (다른 룸)" : ""}
                          </option>
                        ))}
                      </Select>
                      {offs.length > 0 && (
                        <Chip tone="red" className="shrink-0">외출 {offs[0].startTime}~{offs[0].endTime}</Chip>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 이 날 자리 비움 */}
      <Card className="mt-3 p-4">
        <div className="text-[13px] font-bold text-ink">이 날 자리 비움</div>
        <div className="mt-0.5 text-[11px] text-mute">출근은 했지만 그 시간엔 예약을 받지 않아요. 캐치걸이 직접 넣은 것도 여기 보여요.</div>
        {offToday.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line py-6 text-center text-[12px] text-mute">자리 비움 없음</div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {offToday.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-[12px]">
                <span className="font-bold text-ink">{staffName(t.staffId)}</span>
                <span className="text-brand">{t.startTime}~{t.endTime}</span>
                {t.reason && <span className="text-mute">{t.reason}</span>}
                <Chip tone="mute">{t.createdBy === "ADMIN" ? "매장" : "본인"}</Chip>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
