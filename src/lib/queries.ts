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
  remainingToday: number;
  isActive: boolean;
};

export async function listStaffSummaries(store: Store, includeInactive = false): Promise<StaffSummary[]> {
  const staff = await prisma.staff.findMany({
    where: { storeId: store.id, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { sortOrder: "asc" },
    include: { schedules: true, reviews: { where: { isHidden: false }, select: { rating: true } } },
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
      remainingToday: s.isActive ? await remainingToday(store, s) : 0,
      isActive: s.isActive,
    })),
  );
}
