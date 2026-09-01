"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Button, Card, Chip, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, toLocalDate, won, SHIFTS, WEEKDAYS_KO, type Shift } from "@/lib/utils";
import { addMyTimeOff, deleteMyTimeOff, setMyAvailability, setMyOptions } from "../../actions";

type Opt = { id: string; name: string; price: number };
type TimeOff = { id: string; date: string; startTime: string; endTime: string; reason: string; createdBy: string };
type Avail = { weekday: number; shift: Shift };

/** 30분 단위 시각 목록 (영업시간과 무관하게 하루 전체 — 외출은 언제든 잡을 수 있다) */
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

export function StaffSettings({
  slug, today, storeHours, options, myOptionIds, timeOffs, availability,
}: {
  slug: string;
  today: string;
  storeHours: { open: string; close: string; split: string };
  options: Opt[];
  myOptionIds: string[];
  timeOffs: TimeOff[];
  availability: Avail[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [optIds, setOptIds] = useState<string[]>(myOptionIds);
  const [form, setForm] = useState({ date: today, startTime: "14:00", endTime: "15:30", reason: "" });
  const [avail, setAvail] = useState<Avail[]>(availability);

  const toggleSlot = (weekday: number, shift: Shift) =>
    setAvail((v) =>
      v.some((a) => a.weekday === weekday && a.shift === shift)
        ? v.filter((a) => !(a.weekday === weekday && a.shift === shift))
        : [...v, { weekday, shift }],
    );

  const saveAvail = () =>
    start(async () => {
      const r = await setMyAvailability(slug, avail);
      toast(r.ok ? "가능한 시간을 알렸어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  const saveOptions = (next: string[]) => {
    const prev = optIds;
    setOptIds(next);
    start(async () => {
      const r = await setMyOptions(slug, next);
      if (!r.ok) { setOptIds(prev); toast(r.error, "error"); return; }
      toast("저장했어요", "success");
      router.refresh();
    });
  };

  const addOff = () =>
    start(async () => {
      const r = await addMyTimeOff(slug, form);
      if (!r.ok) return toast(r.error, "error");
      toast("자리 비움을 등록했어요", "success");
      setForm({ ...form, reason: "" });
      router.refresh();
    });

  const removeOff = (t: TimeOff) =>
    start(async () => {
      const r = await deleteMyTimeOff(slug, t.id);
      if (!r.ok) return toast(r.error, "error");
      toast("삭제했어요", "success");
      router.refresh();
    });

  return (
    <div className="mt-4 flex flex-col gap-3">
      {/* 출근 가능 표시 — 실제 배치는 매장이 이걸 보고 정한다 */}
      <Card className="p-4">
        <div className="text-[13px] font-bold text-ink">출근 가능한 요일 · 조</div>
        <div className="mt-0.5 text-[11px] leading-[1.7] text-mute">
          가능한 칸을 눌러 표시해 주세요. 매장이 이걸 보고 룸에 배치해요.
          <br />표시했다고 출근이 확정되는 건 아니에요 — <b className="text-ink">실제 근무는 매장 배치로 정해져요.</b>
        </div>

        <div className="mt-3 grid grid-cols-[42px_repeat(7,1fr)] gap-1 text-center">
          <span />
          {WEEKDAYS_KO.map((d, wd) => (
            <span key={d} className={cn("py-1 text-[11px] font-bold", wd === 0 ? "text-brand" : "text-mute")}>{d}</span>
          ))}
          {SHIFTS.map(([shift, label]) => (
            <Fragment key={shift}>
              <span className="flex items-center justify-end pr-1 text-[11px] font-bold text-ink">{label}</span>
              {WEEKDAYS_KO.map((_, wd) => {
                const on = avail.some((a) => a.weekday === wd && a.shift === shift);
                return (
                  <button
                    key={`${shift}-${wd}`}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${WEEKDAYS_KO[wd]}요일 ${label}조`}
                    onClick={() => toggleSlot(wd, shift)}
                    className={cn(
                      "h-11 rounded-xl text-[11px] font-bold transition-colors",
                      on ? "bg-brand text-white" : "border border-line bg-white text-mute hover:border-brand",
                    )}
                  >
                    {on ? "가능" : "—"}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>

        <Button size="sm" onClick={saveAvail} loading={pending} className="mt-3">출근 가능 저장</Button>
        <div className="mt-1.5 text-[10px] text-mute">
          주간 {storeHours.open}~{storeHours.split} · 야간 {storeHours.split}~익일 {storeHours.close}
        </div>
      </Card>

      {/* 제공 옵션 */}
      <Card className="p-4">
        <div className="text-[13px] font-bold text-ink">내가 제공하는 옵션</div>
        <div className="mt-0.5 text-[11px] text-mute">꺼두면 손님 예약 화면에서 그 옵션이 안 보여요.</div>
        <div className="mt-3 flex flex-col gap-2">
          {options.length === 0 && <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">매장에 등록된 옵션이 없어요</div>}
          {options.map((o) => {
            const on = optIds.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                disabled={pending}
                onClick={() => saveOptions(on ? optIds.filter((x) => x !== o.id) : [...optIds, o.id])}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-2xl border px-4 text-[13px] transition-all active:scale-[.99]",
                  on ? "border-brand bg-blush-lt" : "border-line bg-white",
                )}
              >
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border text-[11px]", on ? "border-brand bg-brand text-white" : "border-line bg-white text-transparent")}>✓</span>
                <span className={cn("font-semibold", on ? "text-brand" : "text-ink")}>{o.name}</span>
                <span className="ml-auto text-mute">+{won(o.price)}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 자리 비움 */}
      <Card className="p-4">
        <div className="text-[13px] font-bold text-ink">자리 비움 (외출)</div>
        <div className="mt-0.5 text-[11px] text-mute">
          출근한 날이어도 잠깐 나가야 하면 그 시간을 빼두세요. 그 시간엔 예약이 안 잡혀요.
          매장에도 <b className="text-ink">누가 언제 나갔는지</b> 함께 보여요.
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Field label="날짜"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-11 text-[13px]" /></Field>
          <Field label="사유" hint="선택"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="예: 병원" maxLength={40} className="h-11 text-[13px]" /></Field>
          <Field label="시작">
            <Select value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="h-11 w-full text-[13px]">
              {TIMES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="종료">
            <Select value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="h-11 w-full text-[13px]">
              {TIMES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
        <Button size="sm" onClick={addOff} loading={pending} className="mt-2.5">자리 비움 등록</Button>
        <div className="mt-1.5 text-[10px] text-mute">영업시간은 {storeHours.open}~익일 {storeHours.close}예요.</div>

        <div className="mt-3 flex flex-col gap-2">
          {timeOffs.length === 0 && <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">예정된 자리 비움이 없어요</div>}
          {timeOffs.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-[12px]">
              <span className="font-semibold text-ink">{format(toLocalDate(t.date, "00:00"), "M월 d일 (EEE)", { locale: ko })}</span>
              <span className="text-brand">{t.startTime}~{t.endTime}</span>
              {t.reason && <span className="truncate text-mute">{t.reason}</span>}
              {t.createdBy === "ADMIN" ? (
                <Chip tone="mute" className="ml-auto">매장 등록</Chip>
              ) : (
                <button onClick={() => removeOff(t)} disabled={pending} className="ml-auto text-[11px] font-bold text-mute hover:text-[#C0392B]">삭제</button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
