import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { businessDayRange } from "@/lib/slots";
import { cn, won, wonShort, ymd } from "@/lib/utils";
import { CHANNELS, CHANNEL_LABEL, TIER_LABEL, UNKNOWN_LABEL, type SourceTier } from "@/lib/sources";
import { Card, Chip, Eyebrow } from "@/components/ui";
import { SourcesManager } from "./sources-manager";

export const dynamic = "force-dynamic";

const EARNING = ["CONFIRMED", "COMPLETED"];

export default async function SourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);

  const now = new Date();
  const base = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? new Date(`${sp.month}-01T00:00:00`) : now;
  const mStart = startOfMonth(base);
  const mEnd = endOfMonth(base);
  const range = { gte: businessDayRange(store, ymd(mStart)).start, lt: businessDayRange(store, ymd(mEnd)).end };

  const [sources, newCustomers, monthRes] = await Promise.all([
    prisma.referralSource.findMany({ where: { storeId: store.id }, orderBy: [{ sortOrder: "asc" }] }),
    // 이 달에 등록된 손님 = 이 달의 신규. 어느 사이트를 보고 왔는지가 광고비의 근거다.
    prisma.customer.findMany({
      where: { storeId: store.id, createdAt: { gte: mStart, lt: new Date(mEnd.getTime() + 86_400_000) } },
      select: { id: true, sourceId: true },
    }),
    prisma.reservation.findMany({
      where: { storeId: store.id, status: { in: EARNING }, startTime: range },
      select: { channel: true, totalPrice: true, customerId: true, customer: { select: { sourceId: true, createdAt: true } } },
    }),
  ]);

  // ── 방문 경로별 신규 ──
  const newBySource = new Map<string, number>();
  for (const c of newCustomers) newBySource.set(c.sourceId ?? "", (newBySource.get(c.sourceId ?? "") ?? 0) + 1);
  const totalNew = newCustomers.length;

  // 그 경로로 들어온 손님이 이 달에 실제로 얼마를 썼는지 — 문의 수보다 이쪽이 중요하다
  const spendBySource = new Map<string, number>();
  for (const r of monthRes) {
    const k = r.customer.sourceId ?? "";
    spendBySource.set(k, (spendBySource.get(k) ?? 0) + r.totalPrice);
  }

  const rows = [
    ...sources.map((s) => ({
      id: s.id,
      name: s.name,
      tier: s.tier as SourceTier,
      isActive: s.isActive,
      count: newBySource.get(s.id) ?? 0,
      spend: spendBySource.get(s.id) ?? 0,
    })),
    {
      id: "",
      name: UNKNOWN_LABEL,
      tier: "" as SourceTier,
      isActive: true,
      count: newBySource.get("") ?? 0,
      spend: spendBySource.get("") ?? 0,
    },
  ]
    .filter((r) => r.isActive || r.count > 0)
    .sort((a, b) => b.count - a.count || b.spend - a.spend || a.name.localeCompare(b.name, "ko"));
  const peak = Math.max(1, ...rows.map((r) => r.count));

  // ── 예약 경로별 (앱·전화·텔레그램·워크인) ──
  const byChannel = CHANNELS.map((c) => {
    const list = monthRes.filter((r) => r.channel === c.key);
    return { ...c, count: list.length, spend: list.reduce((a, r) => a + r.totalPrice, 0) };
  });
  const totalRes = monthRes.length;

  // 재방문이 앱으로만 오지 않는다 — 어느 경로로 들어왔든 신규/재방문은 따로 센다
  const newIds = new Set(newCustomers.map((c) => c.id));
  const fromNew = monthRes.filter((r) => newIds.has(r.customerId)).length;

  const monthKey = format(mStart, "yyyy-MM");
  const isThisMonth = monthKey === format(now, "yyyy-MM");

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Sources</Eyebrow>
          <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">{format(mStart, "yyyy년 M월", { locale: ko })} 방문 경로</h1>
          <div className="mt-0.5 text-[11px] leading-[1.8] text-mute">
            신규 손님이 어디를 보고 왔는지예요. 아래 예약 경로는 그와 별개로, 이번 달 예약이 앱·전화·텔레그램 중 어디로 들어왔는지고요.
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`?month=${format(addMonths(mStart, -1), "yyyy-MM")}`} className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-ink">‹ 이전</Link>
          {!isThisMonth && <Link href={`/${slug}/admin/sources`} className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-brand">이번 달</Link>}
          <Link href={`?month=${format(addMonths(mStart, 1), "yyyy-MM")}`} className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-ink">다음 ›</Link>
        </div>
      </div>

      {/* 예약 경로 — 앱으로만 오지 않는다는 걸 숫자로 */}
      <Card className="mt-5 p-5">
        <div className="text-[14px] font-bold text-ink">예약이 들어온 곳</div>
        <div className="mt-0.5 text-[11px] text-mute">
          이번 달 예약 {totalRes}건 · 그중 신규 손님 {fromNew}건 · 재방문 {totalRes - fromNew}건
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {byChannel.map((c) => (
            <div key={c.key} className="rounded-2xl border border-line bg-card p-4">
              <div className="text-[11px] font-semibold text-mute">{c.label}</div>
              <div className="mt-1 font-serif text-[22px] font-bold text-ink">{c.count}건</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-well-2">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${totalRes ? (c.count / totalRes) * 100 : 0}%` }} />
              </div>
              <div className="mt-1.5 text-[10px] text-mute">
                {totalRes ? Math.round((c.count / totalRes) * 100) : 0}% · {wonShort(c.spend)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[10px] leading-[1.7] text-mute">
          단골도 귀찮으면 전화로 예약해요. 그래서 &ldquo;재방문이면 앱&rdquo; 으로 묶지 않고 예약마다 따로 찍어 둬요.
        </div>
      </Card>

      {/* 사이트별 신규 */}
      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <div className="text-[14px] font-bold text-ink">사이트별 신규 손님</div>
          <div className="mt-0.5 text-[11px] text-mute">이번 달 신규 {totalNew}명 · 그 손님들이 이번 달에 쓴 금액까지 같이 봐요</div>
        </div>
        <div className="scroll-x overflow-x-auto">
          <table className="w-full min-w-[520px] text-[12px]">
            <thead>
              <tr className="bg-well text-[11px] font-semibold text-mute">
                <th className="px-5 py-2.5 text-left">사이트</th>
                <th className="w-[70px] px-2 py-2.5 text-right">신규</th>
                <th className="w-[64px] px-2 py-2.5 text-right">비중</th>
                <th className="px-3 py-2.5 text-left">　</th>
                <th className="w-[100px] px-5 py-2.5 text-right">매출</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id || "none"} className="border-t border-line">
                  <td className="px-5 py-2.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("font-bold", r.count > 0 ? "text-ink" : "text-mute")}>{r.name}</span>
                      {r.tier && (
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", r.tier === "MAJOR" ? "bg-gold/25 text-day" : "bg-ok-bg text-ok")}>
                          {TIER_LABEL[r.tier]}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right font-bold text-ink">{r.count || "—"}</td>
                  <td className="px-2 py-2.5 text-right text-mute">{totalNew ? `${Math.round((r.count / totalNew) * 100)}%` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="block h-2 rounded-full bg-well-2">
                      <span className="block h-full rounded-full bg-brand/70" style={{ width: `${(r.count / peak) * 100}%` }} />
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold text-brand">{r.spend ? wonShort(r.spend) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalNew === 0 && (
          <div className="border-t border-line py-8 text-center text-[12px] text-mute">이 달에 등록된 신규 손님이 없어요</div>
        )}
      </Card>

      <SourcesManager slug={slug} items={sources.map((s) => ({ id: s.id, name: s.name, tier: s.tier as SourceTier, isActive: s.isActive }))} />
    </div>
  );
}
