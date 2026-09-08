import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isPlatform } from "@/lib/platform";
import { amountForMonth, firstDebitMonth, monthKey } from "@/lib/platform-data";
import { DEBIT_DAY, PLANS, planOf } from "@/lib/plans";
import { won } from "@/lib/utils";
import { Card, Chip } from "@/components/ui";
import { DebitResult } from "./debit-result";

export const dynamic = "force-dynamic";

/**
 * 이번 달 출금 명단.
 *
 * CMS 사 관리자 화면에 올릴 청구 파일을 여기서 뽑고, 출금 결과(성공한 회원번호)를
 * 붙여 넣어 입금 표시를 한 번에 한다. 개발 연동 없이 CMS 를 쓰는 데 필요한 건 이 둘뿐이다.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  if (!(await isPlatform())) redirect("/platform/login");
  const { month: q } = await searchParams;
  const now = new Date();
  const month = q && /^\d{4}-\d{2}$/.test(q) ? q : monthKey(now);

  const stores = await prisma.store.findMany({
    where: { isSuspended: false },
    orderBy: { name: "asc" },
    include: { payments: { where: { month }, select: { amount: true, paidAt: true } } },
  });

  // 그 달에 청구가 있는 매장만 — 아직 첫 출금일이 안 온 매장은 빠진다
  const rows = stores
    .filter((s) => month >= firstDebitMonth(s.planStartedAt))
    .map((s) => ({
      slug: s.slug, name: s.name, plan: planOf(s.plan), memberNo: s.cmsMemberNo, agreed: !!s.cmsAgreedAt,
      bizName: s.bizName, bizNumber: s.bizNumber, amount: amountForMonth(s, month), paid: s.payments[0] ?? null,
    }));
  const ready = rows.filter((r) => r.memberNo && !r.paid);
  const missing = rows.filter((r) => !r.memberNo);
  const total = ready.reduce((a, r) => a + r.amount, 0);

  const prev = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1);
  const next = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1);

  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link href="/platform" className="text-[12px] text-mute">‹ 매장 콘솔</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">CMS Billing</div>
            <h1 className="mt-1 font-serif text-[24px] font-bold text-ink">{month.replace("-", "년 ")}월 출금 명단</h1>
            <div className="mt-1 text-[12px] text-mute">매월 {DEBIT_DAY}일 출금 · 청구 파일을 CMS 사 관리자 화면에 올리고, 결과가 오면 아래에 붙여 넣어요</div>
          </div>
          <div className="flex items-center gap-1.5 text-[12px]">
            <Link href={`/platform/billing?month=${monthKey(prev)}`} className="rounded-lg border border-line bg-card px-2.5 py-1.5 font-bold text-mute">‹ 전달</Link>
            <Link href={`/platform/billing?month=${monthKey(next)}`} className="rounded-lg border border-line bg-card px-2.5 py-1.5 font-bold text-mute">다음달 ›</Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            ["출금 예정", `${ready.length}곳`, won(total)],
            ["입금 완료", `${rows.filter((r) => r.paid).length}곳`, "이미 표시된 매장"],
            ["회원번호 없음", `${missing.length}곳`, "청구 파일에 못 실어요"],
          ].map(([k, v, s]) => (
            <Card key={k} className="p-4">
              <div className="text-[11px] font-semibold text-mute">{k}</div>
              <div className="mt-1 font-serif text-[22px] font-bold text-ink">{v}</div>
              <div className="mt-0.5 text-[10px] text-mute">{s}</div>
            </Card>
          ))}
        </div>

        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[14px] font-bold text-ink">1. 청구 파일 내려받기</div>
              <div className="mt-0.5 text-[11px] text-mute">회원번호 · 상호 · 사업자번호 · 금액 · 청구월. CMS 사 양식이 다르면 열 이름만 맞춰 주세요.</div>
            </div>
            <a href={`/platform/billing/csv?month=${month}`} className="cta-grad rounded-xl px-4 py-2.5 text-[12px] font-bold text-white shadow-cta" download>CSV 내려받기 ({ready.length}건)</a>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-line bg-well text-[11px] font-bold text-mute">
                  <th className="px-3 py-2">매장</th><th className="px-3 py-2">요금제</th><th className="px-3 py-2">CMS 회원번호</th><th className="px-3 py-2">사업자</th><th className="px-3 py-2 text-right">금액</th><th className="px-3 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-mute">이 달에 청구할 매장이 없어요</td></tr>}
                {rows.map((r) => (
                  <tr key={r.slug} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2 font-bold text-ink"><Link href={`/platform/${r.slug}`} className="hover:underline">{r.name}</Link></td>
                    <td className="px-3 py-2 text-mute">{PLANS[r.plan].name}</td>
                    <td className="px-3 py-2 font-mono text-ink">{r.memberNo || <span className="text-bad">없음</span>}</td>
                    <td className="px-3 py-2 text-mute">{r.bizName} {r.bizNumber}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">{won(r.amount)}</td>
                    <td className="px-3 py-2">{r.paid ? <Chip tone="green">입금</Chip> : r.memberNo ? <Chip tone="gold">출금 예정</Chip> : <Chip tone="red">등록 필요</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="mt-4 p-5">
          <div className="text-[14px] font-bold text-ink">2. 출금 결과 반영</div>
          <div className="mt-0.5 text-[11px] leading-[1.7] text-mute">CMS 사에서 받은 결과 중 <b className="text-ink">성공한 회원번호</b>를 한 줄에 하나씩 붙여 넣으세요. 그 매장들이 {month} 입금으로 표시돼요. 실패한 곳은 그대로 미납으로 남아 콘솔에 빨갛게 떠요.</div>
          <div className="mt-3">
            <DebitResult month={month} readyMemberNos={ready.map((r) => r.memberNo)} />
          </div>
        </Card>
      </div>
    </div>
  );
}
