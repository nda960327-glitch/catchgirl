"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Avatar, Button, Card, Chip, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, toLocalDate, SHIFTS, type Shift } from "@/lib/utils";
import { adminAddTimeOff, adminDeleteTimeOff, clearDayAssignments, copyDayAssignments, setStaffAvailability } from "../../../actions";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 30분 단위 시각 — 외출은 영업시간 밖에도 잡힐 수 있으니 하루 전체를 준다 */
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

type Room = { id: string; name: string };
/** 캐치걸이 스스로 알린 근무 가능 요일·조. 같은 요일이어도 주간만 되는 사람이 있다. */
type StaffLite = { id: string; name: string; photo: string | null; available: { weekday: number; shift: string }[] };
type Assignment = { id: string; date: string; shift: string; roomId: string; staffId: string; startTime: string; endTime: string };
type TimeOff = { id: string; staffId: string; date: string; startTime: string; endTime: string; reason: string; createdBy: string };

export function ScheduleBoard({
  slug, today, date, days, rooms, staff, assignments, timeOffs, track,
}: {
  track: string[];
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
  const [offForm, setOffForm] = useState({ staffId: "", startTime: "14:00", endTime: "15:30", reason: "" });

  // 커버리지 막대의 가로축 (영업 시작~마감을 1시간 칸으로)
  const TRACK = track;
  const trackIndex = (t: string) => {
    const i = TRACK.indexOf(`${t.slice(0, 2)}:00`);
    return i >= 0 ? i : 0;
  };

  const dayOf = (d: string) => assignments.filter((a) => a.date === d);
  const cur = dayOf(date);
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "—";
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "—";

  const offToday = timeOffs.filter((t) => t.date === date);
  const offOf = (staffId: string) => offToday.filter((t) => t.staffId === staffId);
  const weekday = toLocalDate(date, "00:00").getDay();
  const assignedIds = new Set(cur.map((a) => a.staffId));
  const canWork = (s: StaffLite, shift: Shift) => s.available.some((a) => a.weekday === weekday && a.shift === shift);
  const canWorkAnyShift = (s: StaffLite) => s.available.some((a) => a.weekday === weekday);
  // 가능하다고 알렸는데 아직 어느 룸에도 못 넣은 사람 — 배치할 때 놓치지 않게
  const availableUnassigned = staff.filter((s) => canWorkAnyShift(s) && !assignedIds.has(s.id));


  const doCopy = () =>
    start(async () => {
      if (!copyFrom) return;
      if (!confirm(`${copyFrom} 배치를 ${date}(으)로 복사할까요?\n지금 ${date} 배치는 지워집니다.`)) return;
      const r = await copyDayAssignments(slug, copyFrom, date);
      if (!r.ok) return toast(r.error, "error");
      toast(`${r.data?.count}건 복사했어요`, "success");
      router.refresh();
    });

  const addOff = () =>
    start(async () => {
      const r = await adminAddTimeOff(slug, { ...offForm, date });
      if (!r.ok) return toast(r.error, "error");
      toast("자리 비움을 등록했어요", "success");
      setOffForm({ ...offForm, staffId: "", reason: "" });
      router.refresh();
    });

  const removeOff = (t: TimeOff) =>
    start(async () => {
      const r = await adminDeleteTimeOff(slug, t.id);
      if (!r.ok) return toast(r.error, "error");
      toast("삭제했어요", "success");
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

  // 전화로 "나 목요일 야간 돼요" 하고 마는 경우가 많아 매장에서도 대신 켜 줄 수 있어야 한다
  const toggleAvail = (staffId: string, wd: number, shift: Shift, on: boolean) =>
    start(async () => {
      const r = await setStaffAvailability(slug, staffId, wd, shift, on);
      if (!r.ok) return toast(r.error, "error");
      router.refresh();
    });

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

      {/* 이 요일에 가능하다고 알렸는데 아직 안 넣은 사람 */}
      {availableUnassigned.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[#FAF6F7] px-4 py-3">
          <span className="text-[12px] font-bold text-ink">이 요일 가능 · 미배치 {availableUnassigned.length}명</span>
          {availableUnassigned.map((s) => {
            // 어느 조가 된다고 했는지까지 보여야 어디에 넣을지 바로 안다
            const shifts = SHIFTS.filter(([sh]) => canWork(s, sh)).map(([, l]) => l).join("·");
            return (
              <span key={s.id} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2 py-1 text-[11px] font-semibold text-ink">
                <Avatar src={s.photo} name={s.name} size={18} rounded={6} />
                {s.name}
                <span className="text-mute">{shifts}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* 시간대 커버리지 — 누가 몇 시부터 몇 시까지 어느 룸인지 한눈에 */}
      {cur.length > 0 && (
        <Card className="mt-3 p-4">
          <div className="text-[13px] font-bold text-ink">시간대별 근무</div>
          <div className="mt-0.5 text-[11px] text-mute">배치된 실제 시각 기준 · 주간·야간 둘 다 하는 사람은 막대가 두 개예요</div>
          <div className="mt-3 overflow-x-auto">
            <div style={{ minWidth: 90 + TRACK.length * 26 }}>
              <div className="flex">
                <span className="w-[90px] shrink-0" />
                {TRACK.map((t, i) => (
                  <span key={t} className="shrink-0 text-center text-[9px] text-mute" style={{ width: 26 }}>{i % 2 === 0 ? t.slice(0, 2) : ""}</span>
                ))}
              </div>
              {[...new Set(cur.map((a) => a.staffId))].map((sid) => {
                const mineRows = cur.filter((a) => a.staffId === sid);
                const away = offOf(sid);
                return (
                  <div key={sid} className="mt-1 flex items-center">
                    <span className="w-[90px] shrink-0 truncate pr-2 text-[12px] font-bold text-ink">{staffName(sid)}</span>
                    <div className="relative h-7 shrink-0" style={{ width: TRACK.length * 26 }}>
                      {TRACK.map((_, i) => (
                        <span key={i} className="absolute inset-y-0 border-l border-line/60" style={{ left: i * 26, width: 26 }} />
                      ))}
                      {mineRows.map((a) => {
                        const s = trackIndex(a.startTime);
                        const e = trackIndex(a.endTime);
                        const span = (e <= s ? e + TRACK.length : e) - s;
                        return (
                          <span
                            key={a.id}
                            title={`${roomName(a.roomId)} · ${a.startTime}~${a.endTime}`}
                            className="absolute inset-y-1 flex items-center justify-center rounded-md bg-brand px-1 text-[9px] font-bold text-white"
                            style={{ left: s * 26 + 1, width: Math.max(24, span * 26 - 2) }}
                          >
                            {roomName(a.roomId)}
                          </span>
                        );
                      })}
                      {away.map((o) => {
                        const s = trackIndex(o.startTime);
                        const e = trackIndex(o.endTime);
                        const span = (e <= s ? e + TRACK.length : e) - s;
                        return (
                          <span
                            key={o.id}
                            title={`외출 ${o.startTime}~${o.endTime}`}
                            className="absolute inset-y-1 rounded-md bg-[#C0392B]/75"
                            style={{ left: s * 26 + 1, width: Math.max(10, span * 26 - 2) }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* 이 날 자리 비움 */}
      <Card className="mt-3 p-4">
        <div className="text-[13px] font-bold text-ink">이 날 자리 비움</div>
        <div className="mt-0.5 text-[11px] text-mute">출근은 했지만 그 시간엔 예약을 받지 않아요. 캐치걸이 직접 넣은 것도 여기 보여요.</div>

        {/* 매장에서 직접 등록 — "얘 지금 나가 있음" 을 표시 */}
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl bg-[#FAF6F7] p-3">
          <Field label="캐치걸" className="min-w-[130px] flex-1">
            <Select value={offForm.staffId} onChange={(e) => setOffForm({ ...offForm, staffId: e.target.value })} className="h-9 w-full text-[12px]">
              <option value="">선택…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="시작" className="w-[104px]">
            <Select value={offForm.startTime} onChange={(e) => setOffForm({ ...offForm, startTime: e.target.value })} className="h-9 w-full text-[12px]">
              {TIMES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="종료" className="w-[104px]">
            <Select value={offForm.endTime} onChange={(e) => setOffForm({ ...offForm, endTime: e.target.value })} className="h-9 w-full text-[12px]">
              {TIMES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="사유" hint="선택" className="min-w-[110px] flex-1">
            <Input value={offForm.reason} onChange={(e) => setOffForm({ ...offForm, reason: e.target.value })} placeholder="예: 병원" maxLength={40} className="h-9 text-[12px]" />
          </Field>
          <Button size="sm" onClick={addOff} loading={pending} disabled={!offForm.staffId} className="mb-0.5">등록</Button>
        </div>

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
                <button onClick={() => removeOff(t)} disabled={pending} className="text-[11px] font-bold text-mute hover:text-[#C0392B]">✕</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 근무 가능 요일 — 원래는 본인이 앱에서 알리지만 매장에서도 고칠 수 있다 */}
      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[13px] font-bold text-ink">근무 가능 요일</span>
          <span className="text-[11px] text-mute">눌러서 켜고 끄면 바로 저장돼요 · 본인이 앱에서 고친 값과 같은 자리예요</span>
        </div>
        <div className="scroll-x mt-3 overflow-x-auto pb-2">
          <table className="w-full min-w-[620px] border-separate border-spacing-0 text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-1 pb-2 text-left font-semibold text-mute">캐치걸</th>
                {WEEKDAYS.map((d, wd) => (
                  <th key={d} className={cn("px-1 pb-2 text-center font-semibold", wd === weekday ? "text-brand" : "text-mute")}>{d}</th>
                ))}
                <th className="px-1 pb-2 text-right font-semibold text-mute">알림</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const said = s.available.length > 0;
                return (
                  <tr key={s.id}>
                    <td className="sticky left-0 z-10 border-t border-line bg-white py-1.5 pr-2">
                      <span className="flex items-center gap-1.5">
                        <Avatar src={s.photo} name={s.name} size={20} rounded={6} />
                        <span className="font-bold text-ink">{s.name}</span>
                      </span>
                    </td>
                    {WEEKDAYS.map((_, wd) => (
                      <td key={wd} className={cn("border-t border-line px-0.5 py-1.5", wd === weekday && "bg-blush-lt/30")}>
                        <span className="flex justify-center gap-0.5">
                          {SHIFTS.map(([shift, label]) => {
                            const on = s.available.some((a) => a.weekday === wd && a.shift === shift);
                            return (
                              <button
                                key={shift}
                                disabled={pending}
                                onClick={() => toggleAvail(s.id, wd, shift, !on)}
                                title={`${s.name} · ${WEEKDAYS[wd]}요일 ${label}조 ${on ? "가능 해제" : "가능으로"}`}
                                aria-pressed={on}
                                className={cn(
                                  "h-6 w-6 rounded-md text-[10px] font-bold transition-colors disabled:opacity-40",
                                  on
                                    ? shift === "DAY" ? "bg-gold text-white" : "bg-ink text-white"
                                    : "border border-line bg-white text-mute/50 hover:border-brand",
                                )}
                              >
                                {label[0]}
                              </button>
                            );
                          })}
                        </span>
                      </td>
                    ))}
                    <td className="border-t border-line py-1.5 pl-2 text-right">
                      {said ? <span className="text-mute">—</span> : <Chip tone="red">표시 없음</Chip>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 px-1 text-[10px] text-mute">
          <span className="mr-2"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-gold align-middle" />주간</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-ink align-middle" />야간</span>
          <span className="ml-2">· 가능 표시가 없어도 배치는 할 수 있어요. 먼저 물어보시라는 표시예요.</span>
        </div>
      </Card>
    </>
  );
}
