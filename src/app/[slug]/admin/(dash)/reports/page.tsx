import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { toReportRow } from "@/lib/reports";
import { Eyebrow } from "@/components/ui";
import { ReportsAdmin } from "./reports-admin";

/**
 * 신고함 — 손님과 직원이 앱에서 누른 신고가 여기 쌓인다.
 * 같은 신고가 운영사 콘솔에도 올라가 있다는 걸 화면에 그대로 적는다.
 * 매장이 '조용히 지우는' 선택지가 없다는 걸 알아야 제대로 처리한다.
 */
export default async function ReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const rows = await prisma.report.findMany({ where: { storeId: store.id }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300 });
  // OPEN 이 먼저 오도록 — 알파벳순으로 DISMISSED < OPEN < RESOLVED 라 따로 정렬한다
  const reports = rows.map(toReportRow).sort((a, b) => (a.status === "OPEN" ? 0 : 1) - (b.status === "OPEN" ? 0 : 1) || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="animate-fade">
      <Eyebrow>Reports</Eyebrow>
      <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">신고함</h1>
      <p className="mt-1 text-[12px] leading-[1.8] text-mute">
        손님·직원이 앱에서 누른 신고예요. 같은 내용이 운영사 콘솔에도 함께 올라가 있어요. 확인한 뒤 어떻게 조치했는지 적어 두면 운영사도 같이 봐요.
      </p>
      <ReportsAdmin slug={slug} reports={reports} />
    </div>
  );
}
