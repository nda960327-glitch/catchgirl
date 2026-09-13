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
  // 직원이 누구를 차단했는지 — 손님이 특정 직원에게 문제를 일으키고 있다는 신호라 매장이 알아야 한다
  const [staffBlocks, staffNames] = await Promise.all([
    prisma.block.findMany({ where: { storeId: store.id, blockerType: "STAFF" }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.staff.findMany({ where: { storeId: store.id }, select: { id: true, nickname: true } }),
  ]);
  const staffName = new Map(staffNames.map((s) => [s.id, s.nickname]));
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

      <section className="mt-8">
        <h2 className="font-serif text-[17px] font-bold text-ink">직원이 차단한 손님</h2>
        <p className="mt-1 text-[12px] leading-[1.8] text-mute">
          차단된 손님은 그 직원을 예약하거나 그 직원 프로필에 댓글을 달 수 없어요. 같은 손님이 여러 직원에게 차단됐다면 직접 확인해 주세요.
        </p>
        {staffBlocks.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">차단 기록이 없어요</div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-well text-[11px] text-mute">
                <tr><th className="px-4 py-2 font-semibold">손님</th><th className="px-4 py-2 font-semibold">차단한 직원</th><th className="px-4 py-2 font-semibold">날짜</th></tr>
              </thead>
              <tbody>
                {staffBlocks.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="px-4 py-2 font-bold text-ink">{b.blockedName || "손님"}</td>
                    <td className="px-4 py-2 text-ink">{staffName.get(b.blockerId) ?? "삭제된 직원"}</td>
                    <td className="px-4 py-2 text-mute">{b.createdAt.toISOString().slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
