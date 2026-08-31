import "server-only";
import { prisma } from "./db";
import { gradeOf, type Grade } from "./utils";

export type CustomerStats = {
  visitCount: number;
  revisitCount: number;
  cancelCount: number;
  noshowCount: number;
  lastVisitAt: Date | null;
  grade: Grade;
  mainStaffId: string | null;
  mainStaffName: string | null;
  dormant: boolean; // 최근 3개월 미방문
};

export function computeCustomerStats(
  reservations: { status: string; startTime: Date; staffId: string; staff?: { nickname: string } }[],
  now = new Date(),
): CustomerStats {
  const completed = reservations.filter((r) => r.status === "COMPLETED");
  const visitCount = completed.length;
  const lastVisitAt = completed.length ? new Date(Math.max(...completed.map((r) => r.startTime.getTime()))) : null;
  const counts = new Map<string, { n: number; name: string }>();
  for (const r of reservations.filter((r) => r.status !== "CANCELLED")) {
    const c = counts.get(r.staffId) ?? { n: 0, name: r.staff?.nickname ?? "" };
    c.n += 1;
    counts.set(r.staffId, c);
  }
  let mainStaffId: string | null = null;
  let mainStaffName: string | null = null;
  let best = 0;
  for (const [id, c] of counts) if (c.n > best) (best = c.n), (mainStaffId = id), (mainStaffName = c.name);
  const threeMonthsAgo = new Date(now.getTime() - 90 * 86_400_000);
  return {
    visitCount,
    revisitCount: Math.max(0, visitCount - 1),
    cancelCount: reservations.filter((r) => r.status === "CANCELLED").length,
    noshowCount: reservations.filter((r) => r.status === "NOSHOW").length,
    lastVisitAt,
    grade: gradeOf(visitCount),
    mainStaffId,
    mainStaffName,
    dormant: !lastVisitAt || lastVisitAt < threeMonthsAgo,
  };
}

export async function customerStats(customerId: string) {
  const rs = await prisma.reservation.findMany({
    where: { customerId },
    select: { status: true, startTime: true, staffId: true, staff: { select: { nickname: true } } },
  });
  return computeCustomerStats(rs);
}

export type StaffStats = {
  rating: number | null;
  reviewCount: number;
  reservationCount: number;
  completedCount: number;
  noshowRate: number; // 0~1
  revisitRate: number; // 0~1 — 완료 고객 중 2회 이상 방문 비율
};

export async function staffStats(staffId: string): Promise<StaffStats> {
  const [reviews, rs] = await Promise.all([
    prisma.review.findMany({ where: { staffId, isHidden: false }, select: { rating: true } }),
    prisma.reservation.findMany({ where: { staffId }, select: { status: true, customerId: true } }),
  ]);
  const rating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;
  const nonCancelled = rs.filter((r) => r.status !== "CANCELLED");
  const completed = rs.filter((r) => r.status === "COMPLETED");
  const noshow = rs.filter((r) => r.status === "NOSHOW");
  const perCustomer = new Map<string, number>();
  for (const r of completed) perCustomer.set(r.customerId, (perCustomer.get(r.customerId) ?? 0) + 1);
  const custN = perCustomer.size;
  const revisitN = [...perCustomer.values()].filter((n) => n >= 2).length;
  return {
    rating: rating ? Math.round(rating * 10) / 10 : null,
    reviewCount: reviews.length,
    reservationCount: rs.length,
    completedCount: completed.length,
    noshowRate: nonCancelled.length ? noshow.length / nonCancelled.length : 0,
    revisitRate: custN ? revisitN / custN : 0,
  };
}
