import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** 주간조 / 야간조 — 값은 DB(ShiftAssignment.shift)와 URL 쿼리에 그대로 쓴다 */
export const SHIFTS = [
  ["DAY", "주간"],
  ["NIGHT", "야간"],
] as const;
export type Shift = (typeof SHIFTS)[number][0];
export const SHIFT_LABEL: Record<string, string> = { DAY: "주간", NIGHT: "야간" };

/** 각 조가 맡는 시간대 문구 (예: 주간 12:00~20:00 / 야간 20:00~04:00) */
export function shiftHours(store: { openTime: string; closeTime: string; shiftSplitTime: string }, shift: Shift) {
  return shift === "DAY"
    ? { start: store.openTime, end: store.shiftSplitTime }
    : { start: store.shiftSplitTime, end: store.closeTime };
}

/** 매장이 예약 1시간마다 가져가는 금액 (원). 고객이 내는 캐치걸 요금과는 별개다. */
export const STORE_FEE_PER_HOUR = 100_000;

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
/** 큰 금액을 KPI 카드에 넣기 위한 축약 — 1,240만원 / 32만원 */
export function wonShort(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(n % 100_000_000 === 0 ? 0 : 1)}억원`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString("ko-KR")}만원`;
  return won(n);
}

/** 캐치걸 목록 정렬 기준 — 값은 URL 쿼리(?sort=)에 그대로 쓴다.
 *  클라이언트 드롭다운에서도 쓰므로 server-only 인 queries.ts 가 아니라 여기에 둔다. */
export const STAFF_SORTS = [
  ["", "기본순"],
  ["rating", "리뷰 높은순"],
  ["reviews", "리뷰 많은순"],
  ["up", "추천순"],
  ["down", "비추천순"],
  ["price-high", "가격 높은순"],
  ["price-low", "가격 낮은순"],
] as const;
export type StaffSort = (typeof STAFF_SORTS)[number][0];

export function parseJsonArray<T = string>(s: string | null | undefined): T[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}


export function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}
export function hm(d: Date) {
  return format(d, "HH:mm");
}
export function fmtDateKo(d: Date) {
  return format(d, "M월 d일 (EEE)", { locale: ko });
}
export function fmtDateTimeKo(d: Date) {
  return format(d, "M월 d일 (EEE) HH:mm", { locale: ko });
}
export function fmtTimeKo(d: Date) {
  const h = d.getHours();
  return `${h < 12 ? "오전" : "오후"} ${format(d, "HH:mm")}`;
}

/** "YYYY-MM-DD" + "HH:mm" → local Date */
export function toLocalDate(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function addMinutes(d: Date, min: number) {
  return new Date(d.getTime() + min * 60_000);
}

export function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export type Grade = "신규" | "단골" | "VIP";
export function gradeOf(visitCount: number): Grade {
  if (visitCount >= 10) return "VIP";
  if (visitCount >= 5) return "단골";
  return "신규";
}

export const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "예약확정",
  COMPLETED: "방문완료",
  CANCELLED: "취소",
  NOSHOW: "노쇼",
};


/** 브랜드 컬러에서 파생 톤 생성 (화이트라벨) */
export function themeVars(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (t: number, to = 255) => Math.round(r + (to - r) * t);
  const mixG = (t: number, to = 255) => Math.round(g + (to - g) * t);
  const mixB = (t: number, to = 255) => Math.round(b + (to - b) * t);
  const rgb = (R: number, G: number, B: number) => `#${[R, G, B].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return {
    "--brand": hex,
    "--brand-dark": rgb(Math.round(r * 0.85), Math.round(g * 0.85), Math.round(b * 0.85)),
    "--blush": rgb(mix(0.5), mixG(0.5), mixB(0.5)),
    "--blush-lt": rgb(mix(0.88), mixG(0.88), mixB(0.88)),
    "--brand-rgb": `${r},${g},${b}`,
  } as Record<string, string>;
}

export function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 180, g: 88, b: 106 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function genReservationCode(d: Date) {
  const yymm = format(d, "yyMM");
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${yymm}-${rand}`;
}
