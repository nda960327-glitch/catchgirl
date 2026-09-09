import "server-only";
import { prisma } from "./db";
import { commissionOf } from "./commission";
import { monthKey } from "./platform-data";

/**
 * 영업 순위. 담당직원끼리 서로 보는 표라 이름을 그대로 쓰고,
 * 바깥(모집 페이지)에는 성만 남기고 가린다.
 */
export type LeaderRow = {
  id: string;
  name: string;
  code: string;
  stores: number;
  open: number;
  earned: number;      // 확정 + 지급 (전체)
  thisMonth: number;   // 이번 달 확정
  pending: number;     // 승인·첫 출금 대기 중 금액
};

export async function leaderboard(): Promise<LeaderRow[]> {
  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    include: { stores: { include: { payments: { select: { month: true, paidAt: true } } } } },
  });
  const now = monthKey(new Date());
  const rows: LeaderRow[] = agents.map((a) => {
    let earned = 0, thisMonth = 0, pending = 0, open = 0;
    for (const s of a.stores) {
      const c = commissionOf(s, s.payments);
      if (c.status === "CONFIRMED" || c.status === "PAID") { earned += c.amount; if (c.month === now) thisMonth += c.amount; }
      if (c.status === "PENDING_APPROVAL" || c.status === "PENDING_DEBIT") pending += c.amount;
      if (!s.isSuspended) open += 1;
    }
    return { id: a.id, name: a.name, code: a.code, stores: a.stores.length, open, earned, thisMonth, pending };
  });
  return rows.sort((x, y) => y.earned - x.earned || y.stores - x.stores || y.pending - x.pending);
}

/** 바깥에 보여줄 때 — 김○○ */
export const maskName = (n: string) => (n.length <= 1 ? n : n[0] + "○".repeat(Math.min(2, n.length - 1)));
