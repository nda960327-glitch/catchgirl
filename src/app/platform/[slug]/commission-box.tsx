"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip } from "@/components/ui";
import { useToast } from "@/components/providers";
import { won } from "@/lib/utils";
import { markCommissionPaid, unmarkCommissionPaid } from "../actions";

type Status = "NONE" | "PENDING_APPROVAL" | "PENDING_DEBIT" | "CONFIRMED" | "PAID";
const LABEL: Record<Status, string> = { NONE: "해당 없음", PENDING_APPROVAL: "승인 대기", PENDING_DEBIT: "첫 출금 대기", CONFIRMED: "확정 · 지급 대기", PAID: "지급 완료" };
const TONE: Record<Status, "mute" | "gold" | "brand" | "green" | "red"> = { NONE: "mute", PENDING_APPROVAL: "gold", PENDING_DEBIT: "gold", CONFIRMED: "brand", PAID: "green" };

/** 매장 하나의 커미션 — 확정되면 여기서 지급 완료를 누른다 */
export function CommissionBox({ slug, agentName, amount, base, onsite, status, reason, paidAt }: {
  slug: string; agentName: string | null; amount: number; base: number; onsite: number; status: Status; reason: string; paidAt: string | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const act = (paid: boolean) =>
    start(async () => {
      const r = paid ? await markCommissionPaid(slug) : await unmarkCommissionPaid(slug);
      if (!r.ok) return toast(r.error, "error");
      toast(paid ? "지급 완료로 표시했어요" : "지급 표시를 지웠어요", "success");
      router.refresh();
    });

  if (!agentName) return <div className="mt-3 text-[12px] text-mute">담당직원이 없는 매장이에요. 계약 정보에서 지정할 수 있어요.</div>;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-[12px]">
      <span className="font-bold text-ink">{agentName}</span>
      <Chip tone={TONE[status]}>{LABEL[status]}</Chip>
      {amount > 0 && <span className="text-ink">{won(amount)}<span className="text-[10px] text-mute"> (기본 {won(base)}{onsite ? ` + 방문 세팅 ${won(onsite)}` : ""})</span></span>}
      {reason && <span className="text-[11px] text-mute">{reason}</span>}
      {paidAt && <span className="text-[11px] text-mute">{paidAt} 지급</span>}
      <div className="ml-auto">
        {status === "CONFIRMED" && <Button size="sm" onClick={() => act(true)} loading={pending}>지급 완료</Button>}
        {status === "PAID" && <button onClick={() => act(false)} disabled={pending} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-mute hover:text-bad">지급 취소</button>}
      </div>
    </div>
  );
}
