import "server-only";
import type { Store, Staff, StaffSchedule } from "@prisma/client";
import { prisma } from "./db";
import { addMinutes, parseJsonArray, startOfDayLocal, toLocalDate, ymd } from "./utils";

export type SlotStatus = "open" | "full" | "off" | "past";
/** maxHours = 이 시각부터 연달아 예약할 수 있는 최대 시간 (마감까지만)
 *  startsAt = 실제 시작 일시 ISO. 자정 넘김 보정이 끝난 값이라 "지금 가능한가" 판단에 그대로 쓴다. */
export type Slot = { time: string; status: SlotStatus; remaining: number; maxHours: number; startsAt: string };

// 시각 계산은 전부 서버의 로컬 시간대 기준이다. 배포 환경(Vercel 등)은 기본이 UTC 라서
// TZ=Asia/Seoul 을 지정하지 않으면 영업시간·슬롯·"지난 시간" 판정이 통째로 밀린다.
export const ACTIVE_STATUSES = ["CONFIRMED", "COMPLETED", "NOSHOW"];

/** 한 번에 예약할 수 있는 최대 시간 */
export const MAX_BOOKING_HOURS = 8;

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

/* ─── 영업일 ───
   자정이 아니라 마감 시각이 하루의 경계다. 12:00 오픈 · 익일 04:00 마감이면
   9/1 영업일은 [9/1 04:00, 9/2 04:00) 이고, 9/2 새벽 1시는 아직 9/1 영업일이다.
   경계를 마감 시각으로 잡으면 하루들이 빈틈 없이 딱 맞물린다. */

/** 지금이 속한 영업일 (YYYY-MM-DD) */
export function businessDayOf(store: Pick<Store, "openTime" | "closeTime">, now = new Date()) {
  const open = timeToMin(store.openTime);
  const close = timeToMin(store.closeTime);
  if (close > open) return ymd(now); // 자정을 넘기지 않는 매장은 달력 날짜 그대로
  const mins = now.getHours() * 60 + now.getMinutes();
  // 마감 전 새벽이면 아직 어제 영업일
  return mins < close ? ymd(new Date(now.getTime() - 86_400_000)) : ymd(now);
}

/** 그 시각이 주간조인지 야간조인지 */
export function shiftOfTime(store: Pick<Store, "openTime" | "closeTime" | "shiftSplitTime">, at: Date): "DAY" | "NIGHT" {
  const openMin = timeToMin(store.openTime);
  const norm = (m: number) => (m < openMin ? m + 24 * 60 : m);
  const split = norm(timeToMin(store.shiftSplitTime));
  const t = norm(at.getHours() * 60 + at.getMinutes());
  return t < split ? "DAY" : "NIGHT";
}

/** 해당 영업일이 포함하는 실제 시각 범위 */
export function businessDayRange(store: Pick<Store, "openTime" | "closeTime">, date: string) {
  const open = timeToMin(store.openTime);
  const close = timeToMin(store.closeTime);
  if (close > open) {
    const start = toLocalDate(date, "00:00");
    return { start, end: addMinutes(start, 24 * 60) };
  }
  const start = toLocalDate(date, store.closeTime);
  return { start, end: addMinutes(start, 24 * 60) };
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
  // 외출(자리 비움) 구간은 근무 시간이어도 예약을 받지 않는다
  const timeOffs = await prisma.staffTimeOff.findMany({ where: { staffId: staff.id, date }, select: { startTime: true, endTime: true } });

  const dayStart = toLocalDate(date, "00:00");
  const dayEnd = addMinutes(dayStart, 24 * 60 + 6 * 60);
  // 구간 예약이라 하루 앞에서 시작해 넘어온 예약도 잡아야 한다
  const reservations = await prisma.reservation.findMany({
    where: {
      staffId: staff.id,
      status: { in: ACTIVE_STATUSES },
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    },
    select: { startTime: true, endTime: true },
  });
  // 예약이 걸쳐 있는 모든 슬롯을 점유로 센다
  const countByTime = new Map<number, number>();
  const step = store.slotMinutes * 60_000;
  for (const r of reservations) {
    for (let t = r.startTime.getTime(); t < r.endTime.getTime(); t += step) {
      countByTime.set(t, (countByTime.get(t) ?? 0) + 1);
    }
  }

  const base: Slot[] = times.map((time) => {
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
    const startsAt = startAdj.toISOString();
    // 외출 구간에 걸치면 근무 외로 본다.
    // 오픈 시각 이전의 값은 자정을 넘긴 것이므로 하루를 더해 한 줄에 편다.
    const openMin = timeToMin(store.openTime);
    const norm = (m: number) => (m < openMin ? m + 24 * 60 : m);
    const away = timeOffs.some((o) => {
      const a = norm(timeToMin(o.startTime));
      const e = norm(timeToMin(o.endTime));
      const b = e <= a ? e + 24 * 60 : e;
      const t = norm(timeToMin(time));
      return t >= a && t < b;
    });
    if (closed || off || away || !inSchedule || !staff.isActive) return { time, status: "off", remaining: 0, maxHours: 0, startsAt };
    if (startAdj.getTime() <= now.getTime()) return { time, status: "past", remaining: 0, maxHours: 0, startsAt };
    const used = countByTime.get(startAdj.getTime()) ?? 0;
    const remaining = Math.max(0, staff.capacityPerSlot - used);
    return { time, status: remaining > 0 ? "open" : "full", remaining, maxHours: 0, startsAt };
  });
  // 연속 예약 가능 시간은 뒤 슬롯들이 정해져야 알 수 있으므로 한 번 더 훑는다
  for (let i = 0; i < base.length; i++) {
    if (base[i].status === "open") base[i].maxHours = maxHoursAt(base, i, store.slotMinutes);
  }
  // 1시간도 못 채우는 자리는 예약할 수 없으니 마감으로 본다
  for (const s of base) if (s.status === "open" && s.maxHours === 0) s.status = "full";
  return base;
}

/** 예약 가능한 최대 연속 시간(정수 시간). 슬롯 목록이 마감에서 끝나므로 종료 시각은 자동으로 마감 안에 든다. */
export function maxHoursAt(slots: Slot[], index: number, slotMinutes: number, cap = MAX_BOOKING_HOURS): number {
  const perHour = 60 / slotMinutes; // 1시간 = 슬롯 몇 칸
  let run = 0;
  for (let i = index; i < slots.length && slots[i].status === "open"; i++) run++;
  return Math.min(cap, Math.floor(run / perHour));
}

/** 예약 가능 날짜 목록 (오늘 ~ maxAdvanceDays) — 매장 휴무/캐치걸 휴무/근무 없는 요일은 disabled */
export function calendarDays(store: Store, staff: Staff & { schedules: StaffSchedule[]; offs: { date: string }[] }) {
  // 새벽 2시에도 "오늘"은 어제 시작한 영업일이어야 한다
  const today = toLocalDate(businessDayOf(store), "00:00");
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
