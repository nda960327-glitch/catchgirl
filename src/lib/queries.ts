import "server-only";
import type { Store } from "@prisma/client";
import { prisma } from "./db";
import { getSlotsFor } from "./slots";
import { parseJsonArray, ymd } from "./utils";

/** "지금 예약 가능"으로 볼 시간 여유 — 이 안에 시작하는 빈자리가 있으면 지금 가능으로 본다 */
const AVAILABLE_NOW_WINDOW_MIN = 30;

export type StaffSummary = {
  id: string;
  nickname: string;
  bio: string;
  tags: string[];
  photos: string[];
  rating: number | null;
  reviewCount: number;
  upCount: number;
  downCount: number;
  hourlyPrice: number;
  /** 오늘 아직 비어 있는 시간 (1시간 단위). 예약이 1시간 단위라 슬롯 칸 수가 아니라 시간으로 센다. */
  remainingHoursToday: number;
  /** 지금 바로(30분 안에) 시작할 수 있는 빈자리가 있는지 */
  availableNow: boolean;
  /** 오늘 남은 가장 이른 예약 가능 시각 (HH:mm) — 없으면 null */
  nextOpenTime: string | null;
  isActive: boolean;
};

export function sortStaffSummaries(list: StaffSummary[], sort: string): StaffSummary[] {
  const s = [...list];
  switch (sort) {
    case "rating":
      // 후기 없는 캐치걸은 뒤로 — 평점 없음을 0점처럼 취급하지 않는다
      return s.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount);
    case "reviews":
      return s.sort((a, b) => b.reviewCount - a.reviewCount || (b.rating ?? -1) - (a.rating ?? -1));
    case "up":
      return s.sort((a, b) => b.upCount - a.upCount || (b.rating ?? -1) - (a.rating ?? -1));
    case "down":
      return s.sort((a, b) => b.downCount - a.downCount || a.upCount - b.upCount);
    case "price-high":
      return s.sort((a, b) => b.hourlyPrice - a.hourlyPrice || a.nickname.localeCompare(b.nickname));
    case "price-low":
      return s.sort((a, b) => a.hourlyPrice - b.hourlyPrice || a.nickname.localeCompare(b.nickname));
    default:
      return s;
  }
}

export async function listStaffSummaries(store: Store, includeInactive = false): Promise<StaffSummary[]> {
  const staff = await prisma.staff.findMany({
    where: { storeId: store.id, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { sortOrder: "asc" },
    include: {
      schedules: true,
      reviews: { where: { isHidden: false }, select: { rating: true } },
      votes: { select: { value: true } },
    },
  });
  const now = new Date();
  const today = ymd(now);
  const nowCutoff = now.getTime() + AVAILABLE_NOW_WINDOW_MIN * 60_000;

  return Promise.all(
    staff.map(async (s) => {
      // 오늘 슬롯은 한 번만 계산해서 남은 자리 수와 "지금 가능" 여부를 함께 뽑는다
      const slots = s.isActive ? await getSlotsFor(store, s, today, now) : [];
      const open = slots.filter((x) => x.status === "open");
      const next = open[0] ?? null;
      return {
        id: s.id,
        nickname: s.nickname,
        bio: s.bio,
        tags: parseJsonArray(s.tags),
        photos: parseJsonArray(s.photos),
        rating: s.reviews.length ? Math.round((s.reviews.reduce((a, r) => a + r.rating, 0) / s.reviews.length) * 10) / 10 : null,
        reviewCount: s.reviews.length,
        upCount: s.votes.filter((v) => v.value === "UP").length,
        downCount: s.votes.filter((v) => v.value === "DOWN").length,
        hourlyPrice: s.hourlyPrice,
        remainingHoursToday: Math.floor((open.length * store.slotMinutes) / 60),
        availableNow: !!next && new Date(next.startsAt).getTime() <= nowCutoff,
        nextOpenTime: next?.time ?? null,
        isActive: s.isActive,
      };
    }),
  );
}
