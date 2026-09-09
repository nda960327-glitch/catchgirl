import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getAgent } from "@/lib/agent-auth";
import { COMMISSION_STATUS_LABEL, commissionOf, type CommissionStatus } from "@/lib/commission";
import { COMMISSION, COMMITMENT_LABEL, PLANS, commitmentOf, planOf } from "@/lib/plans";
import { PENDING_REASON } from "@/lib/terms";
import { won } from "@/lib/utils";
import { Card, Chip } from "@/components/ui";
import { logoutAgent } from "./actions";
import { CopyLink } from "@/components/copy-link";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const TONE: Record<CommissionStatus, "mute" | "gold" | "brand" | "green" | "red"> = {
  NONE: "mute", PENDING_APPROVAL: "gold", PENDING_DEBIT: "gold", CONFIRMED: "brand", PAID: "green",
};

/**
 * 담당직원 화면 — 내가 데려온 매장과 커미션.
 * 매장 안은 못 들어간다. 이름·요금제·약정·상태·커미션만 보인다.
 */
export default async function AgentPortal({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const agent = await getAgent();
  if (!agent) redirect("/agent/login");
  const { welcome } = await searchParams;
  const host = (await headers()).get("host") ?? "www.catchgirl.kr";
  const base = host.startsWith("localhost") ? `http://${host}` : `https://${host}`;
  const referral = `${base}/signup?agent=${agent.code}`;

  const stores = await prisma.store.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "desc" },
    include: { payments: { select: { month: true, paidAt: true } } },
  });

  const rows = stores.map((s) => {
    const c = commissionOf(s, s.payments);
    return {
      id: s.id, name: s.name, slug: s.slug, plan: planOf(s.plan), commitment: commitmentOf(s.commitment),
      createdAt: s.createdAt, opened: !(s.isSuspended && s.suspendedReason === PENDING_REASON), suspended: s.isSuspended && s.suspendedReason !== PENDING_REASON,
      c,
    };
  });

  // 월별 정산 — 확정된 달 기준
  const byMonth = new Map<string, { confirmed: number; paid: number; count: number }>();
  for (const r of rows) {
    if (!r.c.month || (r.c.status !== "CONFIRMED" && r.c.status !== "PAID")) continue;
    const m = byMonth.get(r.c.month) ?? { confirmed: 0, paid: 0, count: 0 };
    m.confirmed += r.c.amount; m.count += 1;
    if (r.c.status === "PAID") m.paid += r.c.amount;
    byMonth.set(r.c.month, m);
  }
  const months = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const totalConfirmed = rows.filter((r) => r.c.status === "CONFIRMED").reduce((a, r) => a + r.c.amount, 0);
  const totalPaid = rows.filter((r) => r.c.status === "PAID").reduce((a, r) => a + r.c.amount, 0);
  const totalPending = rows.filter((r) => r.c.status === "PENDING_APPROVAL" || r.c.status === "PENDING_DEBIT").reduce((a, r) => a + r.c.amount, 0);

  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Agent</div>
            <h1 className="mt-1 font-serif text-[24px] font-bold text-ink">{agent.name}</h1>
            <div className="mt-1 text-[12px] text-mute">담당 코드 <b className="font-mono text-ink">{agent.code}</b> · 가입 신청서에 이 코드를 적게 하면 내 매장이 돼요</div>
          </div>
          <form action={logoutAgent}>
            <button className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-mute">나가기</button>
          </form>
        </div>

        {welcome && (
          <Card className="mt-5 border-brand/40 bg-blush-lt/40 p-5">
            <div className="font-serif text-[18px] font-bold text-ink">가입됐어요. 내 코드는 <span className="font-mono text-brand">{agent.code}</span></div>
            <p className="mt-1 text-[12px] leading-[1.8] text-mute">매장 사장에게 아래 링크를 보내면 신청서에 코드가 미리 들어가 있어요. 직접 신청서를 쓰는 사장에게는 코드만 알려 줘도 돼요. 매장이 승인되고 첫 출금이 성공하면 커미션이 확정돼요.</p>
          </Card>
        )}

        <Card className="mt-5 p-5">
          <div className="text-[14px] font-bold text-ink">내 소개 링크</div>
          <div className="mt-1 text-[11px] text-mute">이 링크로 신청하면 담당직원 코드가 자동으로 들어가요. 카톡·문자·텔레그램으로 그냥 보내세요.</div>
          <div className="mt-2"><CopyLink value={referral} /></div>
          <div className="mt-2 text-[11px] text-mute">코드만 알려 줄 때: <b className="font-mono text-ink">{agent.code}</b> · 홈페이지 <b className="text-ink">{base.replace(/^https?:\/\//, "")}</b> · 시연 안내 <b className="text-ink">{base.replace(/^https?:\/\//, "")}/demo</b></div>
        </Card>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["내 매장", `${rows.length}곳`, `${rows.filter((r) => r.opened && !r.suspended).length}곳 운영 중`],
            ["지급 대기", won(totalConfirmed), "첫 출금 확인된 매장"],
            ["대기 중", won(totalPending), "승인·첫 출금을 기다려요"],
            ["지급 완료", won(totalPaid), "지금까지 받은 커미션"],
          ].map(([k, v, s]) => (
            <Card key={k} className="p-4">
              <div className="text-[11px] font-semibold text-mute">{k}</div>
              <div className="mt-1 font-serif text-[20px] font-bold text-ink">{v}</div>
              <div className="mt-0.5 text-[10px] text-mute">{s}</div>
            </Card>
          ))}
        </div>

        <Card className="mt-4 p-5">
          <div className="text-[14px] font-bold text-ink">커미션 규칙</div>
          <div className="mt-2 grid gap-2 text-[12px] text-mute md:grid-cols-3">
            <div className="rounded-xl bg-well p-3"><b className="text-ink">Pro</b> 2년 약정 · <b className="text-brand">{won(COMMISSION.PRO)}</b></div>
            <div className="rounded-xl bg-well p-3"><b className="text-ink">Max</b> 2년 약정 · <b className="text-brand">{won(COMMISSION.MAX)}</b></div>
            <div className="rounded-xl bg-well p-3"><b className="text-ink">방문 세팅</b>까지 직접 · <b className="text-brand">+{won(COMMISSION.ONSITE)}</b></div>
          </div>
          <div className="mt-2 text-[11px] leading-[1.7] text-mute">무약정 매장은 커미션이 없어요. 매장이 승인되고 <b className="text-ink">첫 출금이 성공한 달</b>에 확정되고, 운영사가 그달 정산 때 지급해요.</div>
        </Card>

        <Card className="mt-4 p-5">
          <div className="text-[14px] font-bold text-ink">내 매장</div>
          {rows.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-line py-8 text-center text-[12px] text-mute">아직 없어요. 가입 신청서의 담당직원 코드에 <b className="font-mono text-ink">{agent.code}</b>를 적게 하세요.</div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-line bg-well text-[11px] font-bold text-mute">
                    <th className="px-3 py-2">매장</th><th className="px-3 py-2">요금제</th><th className="px-3 py-2">신청일</th><th className="px-3 py-2">매장 상태</th><th className="px-3 py-2 text-right">커미션</th><th className="px-3 py-2">커미션 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2 font-bold text-ink">{r.name}<div className="font-mono text-[10px] font-normal text-mute">/{r.slug}</div></td>
                      <td className="px-3 py-2 text-mute">{PLANS[r.plan].name} · {COMMITMENT_LABEL[r.commitment]}</td>
                      <td className="px-3 py-2 text-mute">{format(r.createdAt, "yy.MM.dd")}</td>
                      <td className="px-3 py-2">{r.suspended ? <Chip tone="red">이용 중지</Chip> : r.opened ? <Chip tone="green">운영 중</Chip> : <Chip tone="gold">승인 대기</Chip>}</td>
                      <td className="px-3 py-2 text-right font-semibold text-ink">{r.c.amount ? won(r.c.amount) : "—"}{r.c.onsite ? <div className="text-[10px] font-normal text-mute">세팅 +{won(r.c.onsite)} 포함</div> : null}</td>
                      <td className="px-3 py-2"><Chip tone={TONE[r.c.status]}>{COMMISSION_STATUS_LABEL[r.c.status]}</Chip>{r.c.reason && <div className="mt-0.5 text-[10px] text-mute">{r.c.reason}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="mt-4 p-5">
          <div className="text-[14px] font-bold text-ink">월별 정산</div>
          {months.length === 0 ? (
            <div className="mt-3 text-[12px] text-mute">확정된 커미션이 아직 없어요.</div>
          ) : (
            <div className="mt-3 divide-y divide-line rounded-2xl border border-line">
              {months.map(([m, v]) => (
                <div key={m} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[12px]">
                  <span className="w-[70px] font-bold text-ink">{m}</span>
                  <span className="text-mute">{v.count}건</span>
                  <span className="font-semibold text-ink">{won(v.confirmed)}</span>
                  <span className="ml-auto">{v.paid >= v.confirmed ? <Chip tone="green">지급 완료</Chip> : v.paid > 0 ? <Chip tone="gold">일부 지급 {won(v.paid)}</Chip> : <Chip tone="brand">지급 대기</Chip>}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
