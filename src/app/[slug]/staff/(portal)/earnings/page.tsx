import Link from "next/link";
import { redirect } from "next/navigation";
import { addMonths, format, startOfMonth, endOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { getStaffUser } from "@/lib/auth";
import { businessDayOf, businessDayRange } from "@/lib/slots";
import { cn, won, wonShort, ymd } from "@/lib/utils";
import { Card, Chip, Eyebrow } from "@/components/ui";

export const dynamic = "force-dynamic";

const EARNING = ["COMPLETED", "CONFIRMED"];

export default async function StaffEarningsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);
  const me = await getStaffUser(store.id);
  if (!me) redirect(`/${slug}/staff/login`);

  const now = new Date();
  const monthBase = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? new Date(`${sp.month}-01T00:00:00`) : now;
  const mStart = startOfMonth(monthBase);
  const mEnd = endOfMonth(monthBase);
  const range = { start: businessDayRange(store, ymd(mStart)).start, end: businessDayRange(store, ymd(mEnd)).end };

  const prevStart = startOfMonth(addMonths(mStart, -1));
  const prevRange = { start: businessDayRange(store, ymd(prevStart)).start, end: businessDayRange(store, ymd(endOfMonth(prevStart))).end };

  const [thisMonth, lastMonth, allMine] = await Promise.all([
    prisma.reservation.findMany({
      where: { staffId: me.id, startTime: { gte: range.start, lt: range.end } },
      include: { customer: { select: { id: true, nickname: true } }, options: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.reservation.findMany({
      where: { staffId: me.id, startTime: { gte: prevRange.start, lt: prevRange.end }, status: { in: EARNING } },
      select: { totalPrice: true, hours: true },
    }),
    // 재방문율은 전체 기간 기준으로 봐야 의미가 있다
    prisma.reservation.findMany({
      where: { staffId: me.id, status: "COMPLETED" },
      select: { customerId: true, startTime: true, totalPrice: true },
    }),
  ]);

  const earning = thisMonth.filter((r) => EARNING.includes(r.status));
  const done = earning.filter((r) => r.status === "COMPLETED");
  const revenue = earning.reduce((a, r) => a + r.totalPrice, 0);
  const doneRevenue = done.reduce((a, r) => a + r.totalPrice, 0);
  const hours = earning.reduce((a, r) => a + r.hours, 0);
  const noshow = thisMonth.filter((r) => r.status === "NOSHOW").length;
  const cancelled = thisMonth.filter((r) => r.status === "CANCELLED").length;

  const lastRevenue = lastMonth.reduce((a, r) => a + r.totalPrice, 0);
  const lastHours = lastMonth.reduce((a, r) => a + r.hours, 0);
  const diff = revenue - lastRevenue;
  const diffPct = lastRevenue > 0 ? Math.round((diff / lastRevenue) * 100) : null;

  // ── 재방문율 (전체 기간) ──
  const visitsByCustomer = new Map<string, number>();
  for (const r of allMine) visitsByCustomer.set(r.customerId, (visitsByCustomer.get(r.customerId) ?? 0) + 1);
  const totalCust = visitsByCustomer.size;
  const repeatCust = [...visitsByCustomer.values()].filter((n) => n >= 2).length;
  const revisitRate = totalCust ? Math.round((repeatCust / totalCust) * 100) : 0;

  // 이번 달 손님 중 나를 처음 만난 사람 = 신규
  const firstSeen = new Map<string, Date>();
  for (const r of allMine) {
    const cur = firstSeen.get(r.customerId);
    if (!cur || r.startTime < cur) firstSeen.set(r.customerId, r.startTime);
  }
  const monthCustomers = new Set(done.map((r) => r.customerId));
  const newThisMonth = [...monthCustomers].filter((id) => {
    const f = firstSeen.get(id);
    return f && f >= range.start && f < range.end;
  }).length;

  // ── 손님별 지출 (이번 달) ──
  const bySpender = new Map<string, { name: string; spent: number; visits: number; hours: number }>();
  for (const r of earning) {
    const v = bySpender.get(r.customerId) ?? { name: r.customer.nickname, spent: 0, visits: 0, hours: 0 };
    v.spent += r.totalPrice;
    v.visits += 1;
    v.hours += r.hours;
    bySpender.set(r.customerId, v);
  }
  const spenders = [...bySpender.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.spent - a.spent);
  const topSpend = Math.max(1, ...spenders.map((s) => s.spent));

  // ── 일자별 ──
  const byDay = new Map<string, number>();
  for (const r of earning) byDay.set(businessDayOf(store, r.startTime), (byDay.get(businessDayOf(store, r.startTime)) ?? 0) + r.totalPrice);
  const peakDay = Math.max(1, ...byDay.values());
  const daysInMonth = Array.from({ length: mEnd.getDate() }, (_, i) => new Date(mStart.getFullYear(), mStart.getMonth(), i + 1));

  const monthKey = format(mStart, "yyyy-MM");
  const isThisMonth = monthKey === format(now, "yyyy-MM");

  return (
    <div className="animate-fade px-5 pb-10 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>My Earnings</Eyebrow>
          <h1 className="mt-1 font-serif text-[20px] font-bold text-ink">{format(mStart, "yyyy년 M월", { locale: ko })} 내 매출</h1>
          <div className="mt-0.5 text-[11px] text-mute">{me.nickname} · 손님이 결제한 금액 기준</div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`?month=${format(addMonths(mStart, -1), "yyyy-MM")}`} className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-bold text-ink">‹ 이전</Link>
          {!isThisMonth && <Link href={`/${slug}/staff/earnings`} className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-bold text-brand">이번 달</Link>}
          <Link href={`?month=${format(addMonths(mStart, 1), "yyyy-MM")}`} className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-bold text-ink">다음 ›</Link>
        </div>
      </div>

      {/* 요약 */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Card className="border-brand/40 bg-blush-lt/30 p-4">
          <div className="text-[11px] font-semibold text-mute">이번 달 매출</div>
          <div className="mt-1 font-serif text-[22px] font-bold text-brand">{wonShort(revenue)}</div>
          <div className="mt-1 text-[11px] text-mute">
            {diffPct === null ? "지난달 기록 없음" : (
              <span className={diff >= 0 ? "text-[#2E8B57]" : "text-[#C0392B]"}>
                지난달 대비 {diff >= 0 ? "▲" : "▼"} {Math.abs(diffPct)}%
              </span>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold text-mute">방문완료 기준</div>
          <div className="mt-1 font-serif text-[22px] font-bold text-ink">{wonShort(doneRevenue)}</div>
          <div className="mt-1 text-[11px] text-mute">{done.length}건 · {hours}시간</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold text-mute">재방문율</div>
          <div className="mt-1 font-serif text-[22px] font-bold text-ink">{revisitRate}%</div>
          <div className="mt-1 text-[11px] text-mute">{repeatCust}/{totalCust}명 재방문</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold text-mute">이번 달 신규</div>
          <div className="mt-1 font-serif text-[22px] font-bold text-ink">{newThisMonth}명</div>
          <div className="mt-1 text-[11px] text-mute">손님 {monthCustomers.size}명 중</div>
        </Card>
      </div>

      {/* 지난달 비교 */}
      <Card className="mt-3 p-4">
        <div className="text-[12px] font-bold text-ink">지난달과 비교</div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
          {[
            { k: format(prevStart, "M월", { locale: ko }), v: wonShort(lastRevenue), s: `${lastHours}시간`, tone: "text-mute" },
            { k: format(mStart, "M월", { locale: ko }), v: wonShort(revenue), s: `${hours}시간`, tone: "text-brand" },
            { k: "차이", v: `${diff >= 0 ? "+" : "−"}${wonShort(Math.abs(diff))}`, s: diffPct === null ? "—" : `${diff >= 0 ? "+" : "−"}${Math.abs(diffPct)}%`, tone: diff >= 0 ? "text-[#2E8B57]" : "text-[#C0392B]" },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-[#FAF6F7] px-2 py-3">
              <div className="text-[10px] text-mute">{x.k}</div>
              <div className={cn("mt-0.5 font-serif text-[16px] font-bold", x.tone)}>{x.v}</div>
              <div className="text-[10px] text-mute">{x.s}</div>
            </div>
          ))}
        </div>
        {(noshow > 0 || cancelled > 0) && (
          <div className="mt-2.5 text-[11px] text-mute">이번 달 노쇼 {noshow}건 · 취소 {cancelled}건 (매출에 미포함)</div>
        )}
      </Card>

      {/* 일자별 */}
      <Card className="mt-3 p-4">
        <div className="text-[12px] font-bold text-ink">일자별 매출</div>
        <div className="mt-3 flex items-end gap-[3px]" style={{ height: 90 }}>
          {daysInMonth.map((d) => {
            const v = byDay.get(ymd(d)) ?? 0;
            return (
              <div key={ymd(d)} className="group flex flex-1 flex-col justify-end" title={`${d.getDate()}일 · ${won(v)}`}>
                <span className="w-full rounded-t bg-brand/70 transition-colors group-hover:bg-brand" style={{ height: `${Math.max(2, (v / peakDay) * 78)}px` }} />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-mute">
          <span>1일</span><span>{mEnd.getDate()}일</span>
        </div>
      </Card>

      {/* 손님별 지출 */}
      <Card className="mt-3 p-4">
        <div className="text-[12px] font-bold text-ink">이번 달 오신 손님</div>
        <div className="mt-0.5 text-[11px] text-mute">많이 쓰신 순 · 재방문 손님은 배지가 붙어요</div>
        {spenders.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line py-8 text-center text-[12px] text-mute">이 달 예약이 없어요</div>
        ) : (
          <div className="mt-2.5 flex flex-col">
            {spenders.map((s, i) => {
              const total = visitsByCustomer.get(s.id) ?? 0;
              return (
                <div key={s.id} className="relative flex items-center gap-2 border-b border-line py-2.5 text-[12px] last:border-0">
                  <span className="absolute inset-y-0 left-0 -z-0 rounded bg-blush-lt/50" style={{ width: `${(s.spent / topSpend) * 100}%` }} />
                  <span className="z-10 w-4 text-[10px] text-mute">{i + 1}</span>
                  <span className="z-10 font-bold text-ink">{s.name}</span>
                  {total >= 2 && <Chip>재방문 {total}회</Chip>}
                  <span className="z-10 ml-auto text-mute">{s.visits}건 · {s.hours}h</span>
                  <span className="z-10 w-[72px] text-right font-bold text-brand">{wonShort(s.spent)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
