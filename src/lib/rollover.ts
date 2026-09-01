import { prisma } from "@/lib/db";

/**
 * 끝난 시간이 지난 "확정" 예약을 방문 완료로 넘긴다.
 *
 * 예약이 끝났으면 더는 예정이 아니다. 매장이 일일이 눌러 주지 않으면 지난주
 * 예약이 계속 "예약 확정"으로 남아 매출·방문 횟수에서 빠진다. 노쇼는 매장만
 * 알 수 있으니 여기서 찍지 않는다 — 완료로 넘긴 뒤 매장이 고치면 된다.
 *
 * 여러 화면에서 불리므로 매장마다 몇 분에 한 번만 실제로 돌린다.
 */
const lastRun = new Map<string, number>();
const INTERVAL_MS = 5 * 60 * 1000;

export async function completeFinishedReservations(storeId: string) {
  const now = Date.now();
  if (now - (lastRun.get(storeId) ?? 0) < INTERVAL_MS) return 0;
  lastRun.set(storeId, now);
  try {
    const r = await prisma.reservation.updateMany({
      where: { storeId, status: "CONFIRMED", endTime: { lt: new Date() } },
      data: { status: "COMPLETED" },
    });
    return r.count;
  } catch {
    // 화면을 막을 일은 아니다
    return 0;
  }
}
