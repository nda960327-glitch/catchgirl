import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isPlatform } from "@/lib/platform";
import { commissionOf } from "@/lib/commission";
import { COMMISSION } from "@/lib/plans";
import { won } from "@/lib/utils";
import { Card } from "@/components/ui";
import { AgentsManager, type AgentRow } from "./agents-manager";

export const dynamic = "force-dynamic";

/**
 * 담당직원 관리 — 계정을 만들고, 누가 몇 곳을 데려왔고 얼마를 줘야 하는지 본다.
 */
export default async function AgentsPage() {
  if (!(await isPlatform())) redirect("/platform/login");
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "asc" },
    include: { stores: { include: { payments: { select: { month: true, paidAt: true } } } } },
  });
  const rows: AgentRow[] = agents.map((a) => {
    const cs = a.stores.map((s) => commissionOf(s, s.payments));
    return {
      id: a.id, name: a.name, code: a.code, contact: a.contact, loginId: a.loginId, isActive: a.isActive,
      storeCount: a.stores.length,
      confirmed: cs.filter((c) => c.status === "CONFIRMED").reduce((x, c) => x + c.amount, 0),
      paid: cs.filter((c) => c.status === "PAID").reduce((x, c) => x + c.amount, 0),
      pending: cs.filter((c) => c.status === "PENDING_APPROVAL" || c.status === "PENDING_DEBIT").reduce((x, c) => x + c.amount, 0),
    };
  });
  const owed = rows.reduce((a, r) => a + r.confirmed, 0);

  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link href="/platform" className="text-[12px] text-mute">‹ 매장 콘솔</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Agents</div>
            <h1 className="mt-1 font-serif text-[24px] font-bold text-ink">담당직원</h1>
            <div className="mt-1 text-[12px] text-mute">
              2년 약정 Pro {won(COMMISSION.PRO)} · Max {won(COMMISSION.MAX)} · 방문 세팅까지 하면 +{won(COMMISSION.ONSITE)}. 첫 출금이 성공한 달에 확정돼요. 지급은 매장 페이지에서 눌러요.
            </div>
          </div>
          <div className="rounded-2xl bg-card px-4 py-3 text-[11px] leading-[1.9] shadow-card">
            <div className="text-mute">지급해야 할 커미션 <b className="text-ink">{won(owed)}</b></div>
            <div className="text-mute">직원 <b className="text-ink">{rows.filter((r) => r.isActive).length}명</b> 활동 중</div>
          </div>
        </div>
        <Card className="mt-5 p-5">
          <AgentsManager rows={rows} />
        </Card>
        <div className="mt-3 text-[11px] text-mute">직원 로그인 주소: <span className="font-mono text-ink">/agent/login</span> · 아이디와 비밀번호를 만들어서 알려 주세요. 코드는 가입 신청서의 "담당직원 코드" 칸에 적게 하면 돼요.</div>
      </div>
    </div>
  );
}
