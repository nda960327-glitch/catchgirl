import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isPlatform } from "@/lib/platform";
import { amountForMonth, firstDebitMonth, monthKey } from "@/lib/platform-data";
import { PLANS, planOf } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * GET /platform/billing/csv?month=YYYY-MM — CMS 사에 올릴 청구 파일.
 * 회원번호가 있고 아직 입금 표시가 안 된 매장만. 엑셀에서 바로 열리게 BOM 을 붙인다.
 */
export async function GET(req: NextRequest) {
  if (!(await isPlatform())) return new NextResponse("unauthorized", { status: 401 });
  const q = req.nextUrl.searchParams.get("month") ?? "";
  const now = new Date();
  const month = /^\d{4}-\d{2}$/.test(q) ? q : monthKey(now);

  const stores = await prisma.store.findMany({
    where: { isSuspended: false, NOT: { cmsMemberNo: "" } },
    orderBy: { name: "asc" },
    include: { payments: { where: { month }, select: { id: true } } },
  });
  const rows = stores
    .filter((s) => s.payments.length === 0 && month >= firstDebitMonth(s.planStartedAt))
    .map((s) => [s.cmsMemberNo, s.name, s.bizName, s.bizNumber, PLANS[planOf(s.plan)].name, String(amountForMonth(s, month)), month, `캐치걸 ${month.replace("-", ".")} 이용료`]);

  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = ["회원번호", "매장명", "상호", "사업자등록번호", "요금제", "청구금액", "청구월", "적요"];
  const body = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  return new NextResponse("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cms-billing-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
