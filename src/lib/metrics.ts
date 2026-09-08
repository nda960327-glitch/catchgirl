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

/**
 * 매장 손님 전원의 통계를 한 번에.
 *
 * 목록 화면이 손님마다 예약을 통째로 끌어오면, 이력이 10년 쌓인 매장에서는
 * 화면 하나에 수만 행을 읽는다. 여기서는 DB 가 세게 하고 손님당 숫자 몇 개만 받는다.
 * 규칙은 computeCustomerStats 와 같다 — 방문 = 완료, 주 지정 = 취소 제외 최다.
 */
export async function customerStatsBulk(storeId: string, now = new Date()) {
  const [byStatus, lastDone, byStaff, spend, staff] = await Promise.all([
    prisma.reservation.groupBy({ by: ["customerId", "status"], where: { storeId }, _count: { _all: true } }),
    prisma.reservation.groupBy({ by: ["customerId"], where: { storeId, status: "COMPLETED" }, _max: { startTime: true } }),
    prisma.reservation.groupBy({ by: ["customerId", "staffId"], where: { storeId, status: { not: "CANCELLED" } }, _count: { _all: true } }),
    prisma.reservation.groupBy({ by: ["customerId"], where: { storeId, status: { in: ["COMPLETED", "CONFIRMED"] } }, _sum: { totalPrice: true } }),
    prisma.staff.findMany({ where: { storeId }, select: { id: true, nickname: true } }),
  ]);
  const staffName = new Map(staff.map((s) => [s.id, s.nickname]));
  const threeMonthsAgo = new Date(now.getTime() - 90 * 86_400_000);

  const out = new Map<string, CustomerStats & { spent: number }>();
  const ensure = (cid: string) => {
    let v = out.get(cid);
    if (!v) {
      v = { visitCount: 0, revisitCount: 0, cancelCount: 0, noshowCount: 0, lastVisitAt: null, grade: "신규", mainStaffId: null, mainStaffName: null, dormant: true, spent: 0 };
      out.set(cid, v);
    }
    return v;
  };
  for (const r of byStatus) {
    const v = ensure(r.customerId);
    if (r.status === "COMPLETED") v.visitCount = r._count._all;
    else if (r.status === "CANCELLED") v.cancelCount = r._count._all;
    else if (r.status === "NOSHOW") v.noshowCount = r._count._all;
  }
  for (const r of lastDone) ensure(r.customerId).lastVisitAt = r._max.startTime;
  const best = new Map<string, number>();
  for (const r of byStaff) {
    const v = ensure(r.customerId);
    if (r._count._all > (best.get(r.customerId) ?? 0)) {
      best.set(r.customerId, r._count._all);
      v.mainStaffId = r.staffId;
      v.mainStaffName = staffName.get(r.staffId) ?? null;
    }
  }
  for (const r of spend) ensure(r.customerId).spent = r._sum.totalPrice ?? 0;
  for (const v of out.values()) {
    v.revisitCount = Math.max(0, v.visitCount - 1);
    v.grade = gradeOf(v.visitCount);
    v.dormant = !v.lastVisitAt || v.lastVisitAt < threeMonthsAgo;
  }
  return out;
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
  upCount: number;
  downCount: number;
  /** 이 캐치걸을 만난 손님 수 */
  customerCount: number;
  /** 그중 두 번 이상 온 손님 수 */
  repeatCustomers: number;
  /** 최근 30일 안에 이 캐치걸을 처음 만난 손님 수 */
  newCustomers30d: number;
};

export async function staffStats(staffId: string): Promise<StaffStats> {
  const [reviews, rs, votes] = await Promise.all([
    prisma.review.findMany({ where: { staffId, isHidden: false }, select: { rating: true } }),
    prisma.reservation.findMany({ where: { staffId }, select: { status: true, customerId: true, startTime: true } }),
    prisma.staffVote.findMany({ where: { staffId }, select: { value: true } }),
  ]);
  const rating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;
  const nonCancelled = rs.filter((r) => r.status !== "CANCELLED");
  const completed = rs.filter((r) => r.status === "COMPLETED");
  const noshow = rs.filter((r) => r.status === "NOSHOW");
  const perCustomer = new Map<string, number>();
  for (const r of completed) perCustomer.set(r.customerId, (perCustomer.get(r.customerId) ?? 0) + 1);
  const custN = perCustomer.size;
  const revisitN = [...perCustomer.values()].filter((n) => n >= 2).length;
  // 이 캐치걸을 "처음" 만난 시점 기준 — 최근 30일 안이면 신규로 본다
  const firstSeen = new Map<string, Date>();
  for (const r of completed) {
    const cur = firstSeen.get(r.customerId);
    if (!cur || r.startTime < cur) firstSeen.set(r.customerId, r.startTime);
  }
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  const newRecently = [...firstSeen.values()].filter((d) => d >= cutoff).length;
  return {
    rating: rating ? Math.round(rating * 10) / 10 : null,
    reviewCount: reviews.length,
    reservationCount: rs.length,
    completedCount: completed.length,
    noshowRate: nonCancelled.length ? noshow.length / nonCancelled.length : 0,
    revisitRate: custN ? revisitN / custN : 0,
    upCount: votes.filter((v) => v.value === "UP").length,
    downCount: votes.filter((v) => v.value === "DOWN").length,
    customerCount: custN,
    repeatCustomers: revisitN,
    newCustomers30d: newRecently,
  };
}
