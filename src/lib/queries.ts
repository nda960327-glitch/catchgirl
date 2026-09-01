import "server-only";
import type { Store } from "@prisma/client";
import { prisma } from "./db";
import { remainingToday } from "./slots";
import { parseJsonArray } from "./utils";

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
  remainingToday: number;
  isActive: boolean;
};

/** 캐치걸 목록 정렬 기준 — 값은 URL 쿼리(?sort=)에 그대로 쓴다 */
export const STAFF_SORTS = [
  ["", "기본순"],
  ["rating", "리뷰 높은순"],
  ["reviews", "리뷰 많은순"],
  ["up", "추천순"],
  ["down", "비추천순"],
] as const;
export type StaffSort = (typeof STAFF_SORTS)[number][0];

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
  return Promise.all(
    staff.map(async (s) => ({
      id: s.id,
      nickname: s.nickname,
      bio: s.bio,
      tags: parseJsonArray(s.tags),
      photos: parseJsonArray(s.photos),
      rating: s.reviews.length ? Math.round((s.reviews.reduce((a, r) => a + r.rating, 0) / s.reviews.length) * 10) / 10 : null,
      reviewCount: s.reviews.length,
      upCount: s.votes.filter((v) => v.value === "UP").length,
      downCount: s.votes.filter((v) => v.value === "DOWN").length,
      remainingToday: s.isActive ? await remainingToday(store, s) : 0,
      isActive: s.isActive,
    })),
  );
}
