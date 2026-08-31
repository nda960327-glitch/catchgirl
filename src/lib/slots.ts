import "server-only";
import type { Store, Staff, StaffSchedule } from "@prisma/client";
import { prisma } from "./db";
import { addMinutes, parseJsonArray, startOfDayLocal, toLocalDate, ymd } from "./utils";

export type SlotStatus = "open" | "full" | "off" | "past";
export type Slot = { time: string; status: SlotStatus; remaining: number };

export const ACTIVE_STATUSES = ["CONFIRMED", "COMPLETED", "NOSHOW"];

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** 매장 영업시간 기준 전체 슬롯 시각 목록 (HH:mm) */
export function storeSlotTimes(store: Pick<Store, "openTime" | "closeTime" | "slotMinutes">) {
  const open = timeToMin(store.openTime);
  let close = timeToMin(store.closeTime);
  if (close <= open) close += 24 * 60; // 자정 넘김
  const out: string[] = [];
  for (let t = open; t < close; t += store.slotMinutes) out.push(minToTime(t % (24 * 60)));
  return out;
}

export function isStoreClosed(store: Pick<Store, "closedDays">, date: string) {
  const wd = toLocalDate(date, "00:00").getDay();
  return parseJsonArray<number>(store.closedDays).includes(wd);
}

/** 특정 캐치걸의 특정 날짜 슬롯 상태 계산 */
export async function getSlotsFor(
  store: Store,
  staff: Staff & { schedules: StaffSchedule[] },
  date: string,
  now = new Date(),
): Promise<Slot[]> {
  const times = storeSlotTimes(store);
  const weekday = toLocalDate(date, "00:00").getDay();
  const closed = isStoreClosed(store, date);
  const off = await prisma.staffOff.findUnique({ where: { staffId_date: { staffId: staff.id, date } } });
  const scheds = staff.schedules.filter((s) => s.weekday === weekday);

  const dayStart = toLocalDate(date, "00:00");
  const dayEnd = addMinutes(dayStart, 24 * 60 + 6 * 60);
  const reservations = await prisma.reservation.findMany({
    where: {
      staffId: staff.id,
      status: { in: ACTIVE_STATUSES },
      startTime: { gte: dayStart, lt: dayEnd },
    },
    select: { startTime: true },
  });
  const countByTime = new Map<number, number>();
  for (const r of reservations) {
    const k = r.startTime.getTime();
    countByTime.set(k, (countByTime.get(k) ?? 0) + 1);
  }

  return times.map((time) => {
    const start = toLocalDate(date, time);
    // 자정 넘김 슬롯 보정
    const startAdj = timeToMin(time) < timeToMin(store.openTime) ? addMinutes(start, 24 * 60) : start;
    const inSchedule = scheds.some((s) => {
      const a = timeToMin(s.startTime);
      let b = timeToMin(s.endTime);
      let t = timeToMin(time);
      if (b <= a) b += 24 * 60;
      if (t < a) t += 24 * 60;
      return t >= a && t < b;
    });
    if (closed || off || !inSchedule || !staff.isActive) return { time, status: "off", remaining: 0 };
    if (startAdj.getTime() <= now.getTime()) return { time, status: "past", remaining: 0 };
    const used = countByTime.get(startAdj.getTime()) ?? 0;
    const remaining = Math.max(0, staff.capacityPerSlot - used);
    return { time, status: remaining > 0 ? "open" : "full", remaining };
  });
}

/** 오늘 남은 예약 가능 슬롯 수 */
export async function remainingToday(store: Store, staff: Staff & { schedules: StaffSchedule[] }) {
  const slots = await getSlotsFor(store, staff, ymd(new Date()));
  return slots.filter((s) => s.status === "open").length;
}

/** 예약 가능 날짜 목록 (오늘 ~ maxAdvanceDays) — 매장 휴무/캐치걸 휴무/근무 없는 요일은 disabled */
export function calendarDays(store: Store, staff: Staff & { schedules: StaffSchedule[]; offs: { date: string }[] }) {
  const today = startOfDayLocal(new Date());
  const out: { date: string; weekday: number; disabled: boolean; reason?: string }[] = [];
  const offSet = new Set(staff.offs.map((o) => o.date));
  for (let i = 0; i <= store.maxAdvanceDays; i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    const date = ymd(d);
    const wd = d.getDay();
    let disabled = false;
    let reason: string | undefined;
    if (isStoreClosed(store, date)) (disabled = true), (reason = "매장 휴무");
    else if (offSet.has(date)) (disabled = true), (reason = "휴무");
    else if (!staff.schedules.some((s) => s.weekday === wd)) (disabled = true), (reason = "근무 없음");
    out.push({ date, weekday: wd, disabled, reason });
  }
  return out;
}
