import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isPlatform } from "@/lib/platform";
import { toReportRow } from "@/lib/reports";
import { ReportsConsole } from "./reports-console";

/**
 * 신고 콘솔 — 모든 매장의 신고가 한 줄로 모인다.
 *
 * 약관 4항(즉시 정지)을 실제로 지키는 자리다. 매장이 아직 안 봤어도 여기엔 떠 있고,
 * 운영사가 닫은 신고는 매장이 되돌리지 못한다.
 */
export const dynamic = "force-dynamic";

export default async function PlatformReportsPage() {
  if (!(await isPlatform())) redirect("/platform/login");
  const rows = await prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 500, include: { store: { select: { name: true, slug: true, isSuspended: true } } } });
  const reports = rows
    .map((r) => ({ ...toReportRow(r), store: r.store }))
    .sort((a, b) => (a.status === "OPEN" ? 0 : 1) - (b.status === "OPEN" ? 0 : 1) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Platform · Reports</div>
            <h1 className="mt-1 font-serif text-[24px] font-bold text-ink">신고</h1>
            <p className="mt-1 text-[12px] leading-[1.8] text-mute">
              모든 매장의 손님·직원 신고예요. 성매매 알선·미성년자·성적 요구가 반복되는 매장은 매장 페이지에서 바로 정지할 수 있어요.
            </p>
          </div>
          <Link href="/platform" className="rounded-xl border border-line bg-card px-3.5 py-2 text-[12px] font-bold text-mute">← 콘솔</Link>
        </div>
        <ReportsConsole reports={reports} />
      </div>
    </div>
  );
}
