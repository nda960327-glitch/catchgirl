import "server-only";
import { COMMISSION, commitmentOf, planOf } from "./plans";
import { firstDebitMonth, monthKey } from "./platform-data";
import { PENDING_REASON } from "./terms";

/**
 * 담당직원 커미션.
 *
 * 2년 약정 매장만 대상이고, 첫 출금이 성공한 달에 확정된다 — 승인만 하고 첫 달에
 * 사라지는 매장에 커미션을 먼저 주면 돌려받을 길이 없다. 확정 뒤 운영사가 지급
 * 표시를 하면 끝. 무약정 매장은 커미션이 없다.
 */
export type CommissionStatus = "NONE" | "PENDING_APPROVAL" | "PENDING_DEBIT" | "CONFIRMED" | "PAID";

export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  NONE: "해당 없음",
  PENDING_APPROVAL: "승인 대기",
  PENDING_DEBIT: "첫 출금 대기",
  CONFIRMED: "확정 · 지급 대기",
  PAID: "지급 완료",
};

export type StoreForCommission = {
  plan: string;
  commitment: string;
  agentId: string | null;
  agentDidOnsite: boolean;
  isSuspended: boolean;
  suspendedReason: string;
  planStartedAt: Date;
  commissionPaidAt: Date | null;
};

export function commissionOf(store: StoreForCommission, payments: { month: string; paidAt: Date }[]) {
  const none = { base: 0, onsite: 0, amount: 0, status: "NONE" as CommissionStatus, confirmedAt: null as Date | null, month: null as string | null, reason: "" };
  if (!store.agentId) return { ...none, reason: "담당직원 없음" };
  if (commitmentOf(store.commitment) !== "TERM24") return { ...none, reason: "무약정은 커미션이 없어요" };
  const base = COMMISSION[planOf(store.plan)];
  const onsite = store.agentDidOnsite ? COMMISSION.ONSITE : 0;
  const amount = base + onsite;
  if (store.isSuspended && store.suspendedReason === PENDING_REASON) return { base, onsite, amount, status: "PENDING_APPROVAL" as CommissionStatus, confirmedAt: null, month: null, reason: "" };
  const first = firstDebitMonth(store.planStartedAt);
  const p = payments.find((x) => x.month === first);
  if (!p) return { base, onsite, amount, status: "PENDING_DEBIT" as CommissionStatus, confirmedAt: null, month: first, reason: `${first} 출금이 성공하면 확정` };
  return {
    base, onsite, amount,
    status: (store.commissionPaidAt ? "PAID" : "CONFIRMED") as CommissionStatus,
    confirmedAt: p.paidAt,
    month: monthKey(p.paidAt),
    reason: "",
  };
}
