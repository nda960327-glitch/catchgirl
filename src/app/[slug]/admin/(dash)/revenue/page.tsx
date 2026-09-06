import Link from "next/link";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { businessDayOf, businessDayRange, storeSlotTimes } from "@/lib/slots";
import { cn, parseJsonArray, won, wonShort, ymd, STORE_FEE_PER_HOUR, WEEKDAYS_KO } from "@/lib/utils";
import { Avatar, Card, Chip, Eyebrow } from "@/components/ui";
import { PlanBadge } from "@/components/admin-nav";
import { PLANS, planOf } from "@/lib/plans";

export const dynamic = "force-dynamic";

/** 매출로 잡는 상태 — 취소는 물론 노쇼도 수익이 아니다 */
const EARNING = ["COMPLETED", "CONFIRMED"];

export default async function RevenuePage({
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

  const canExport = PLANS[planOf(store.plan)].dataExport;

  const monthBase = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? new Date(`${sp.month}-01T00:00:00`) : now;
  const mStart = startOfMonth(monthBase);
  const mEnd = endOfMonth(monthBase);
  // 월의 첫 영업일 시작 ~ 마지막 영업일 끝 (마감이 익일 새벽이므로 끝을 하루 넘겨 잡는다)
  const rangeStart = businessDayRange(store, ymd(mStart)).start;
  const rangeEnd = businessDayRange(store, ymd(mEnd)).end;

  const [reservations, staff] = await Promise.all([
    prisma.reservation.findMany({
      where: { storeId: store.id, startTime: { gte: rangeStart, lt: rangeEnd } },
      include: { staff: { select: { id: true, nickname: true, photos: true } }, customer: { select: { id: true, nickname: true } }, options: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.staff.findMany({ where: { storeId: store.id }, orderBy: { sortOrder: "asc" }, select: { id: true, nickname: true, photos: true } }),
  ]);

  const earning = reservations.filter((r) => EARNING.includes(r.status));
  const fee = (hours: number) => hours * STORE_FEE_PER_HOUR;

  const totalHours = earning.reduce((a, r) => a + r.hours, 0);
  const doneHours = earning.filter((r) => r.status === "COMPLETED").reduce((a, r) => a + r.hours, 0);
  const storeRevenue = fee(totalHours);
  const customerPaid = earning.reduce((a, r) => a + r.totalPrice, 0);
  const optionRevenue = earning.reduce((a, r) => a + r.optionsPrice, 0);
  const noshowLoss = fee(reservations.filter((r) => r.status === "NOSHOW").reduce((a, r) => a + r.hours, 0));
  const avgPerBooking = earning.length ? Math.round(customerPaid / earning.length) : 0;

  // ── 일자별 (영업일 기준) ──
  const byDay = new Map<string, { hours: number; count: number }>();
  for (const r of earning) {
    const d = businessDayOf(store, r.startTime);
    const v = byDay.get(d) ?? { hours: 0, count: 0 };
    v.hours += r.hours;
    v.count += 1;
    byDay.set(d, v);
  }
  const peakDayHours = Math.max(1, ...[...byDay.values()].map((v) => v.hours));

  // 달력 격자 (일요일 시작)
  const gridStart = new Date(mStart);
  gridStart.setDate(1 - mStart.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86_400_000));
  // 마지막 주가 통째로 다음 달이면 그 줄은 그리지 않는다
  const weeks = cells.slice(35).some((d) => d.getMonth() === mStart.getMonth()) ? 6 : 5;

  // ── 직원별 ──
  const byStaff = staff
    .map((s) => {
      const rs = earning.filter((r) => r.staffId === s.id);
      const hours = rs.reduce((a, r) => a + r.hours, 0);
      return {
        id: s.id,
        name: s.nickname,
        photo: parseJsonArray<string>(s.photos)[0] ?? null,
        count: rs.length,
        hours,
        storeFee: fee(hours),
        paid: rs.reduce((a, r) => a + r.totalPrice, 0),
      };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.hours - a.hours);
  const peakStaffHours = Math.max(1, ...byStaff.map((s) => s.hours));

  // ── 큰손 (이번 달 많이 쓴 손님) ──
  const bySpender = new Map<string, { name: string; spent: number; visits: number; hours: number }>();
  for (const r of earning) {
    const v = bySpender.get(r.customerId) ?? { name: r.customer.nickname, spent: 0, visits: 0, hours: 0 };
    v.spent += r.totalPrice;
    v.visits += 1;
    v.hours += r.hours;
    bySpender.set(r.customerId, v);
  }
  const spenders = [...bySpender.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.spent - a.spent).slice(0, 15);
  const topSpend = Math.max(1, ...spenders.map((s) => s.spent));

  // ── 요일별 ──
  const byWeekday = WEEKDAYS_KO.map((label, wd) => {
    const hours = earning
      .filter((r) => new Date(`${businessDayOf(store, r.startTime)}T00:00:00`).getDay() === wd)
      .reduce((a, r) => a + r.hours, 0);
    return { label, hours };
  });
  const peakWeekday = Math.max(1, ...byWeekday.map((d) => d.hours));

  // ── 시간대별 (예약 시작 시각) ──
  const times = storeSlotTimes(store).filter((_, i) => i % (60 / store.slotMinutes) === 0);
  const byHour = times.map((t) => {
    const hh = t.slice(0, 2);
    const hours = earning.filter((r) => format(r.startTime, "HH") === hh).reduce((a, r) => a + r.hours, 0);
    return { label: t, hours };
  });
  const peakHour = Math.max(1, ...byHour.map((h) => h.hours));

  const monthKey = format(mStart, "yyyy-MM");
  const prev = format(addMonths(mStart, -1), "yyyy-MM");
  const next = format(addMonths(mStart, 1), "yyyy-MM");
  const isThisMonth = monthKey === format(now, "yyyy-MM");

  // 매출(손님이 낸 총액)과 매장 몫(수수료)은 다른 돈이다 — 섞어 부르지 않는다.
  // 할인은 매장이 부담하므로 캐치걸 몫은 정가 기준이고, 매장 몫에서만 빠진다.
  const discountTotal = earning.reduce((a, r) => a + r.discountAmount, 0);
  const staffPayout = customerPaid + discountTotal - storeRevenue;
  const kpis = [
    { label: "총 매출", value: wonShort(customerPaid), sub: `손님이 낸 금액 · 옵션 ${wonShort(optionRevenue)} 포함` },
    { label: "매장 몫 (수수료)", value: wonShort(storeRevenue - discountTotal), sub: `${totalHours}시간 × ${won(STORE_FEE_PER_HOUR)} − 할인 ${wonShort(discountTotal)}`, strong: true },
    { label: "캐치걸 몫", value: wonShort(staffPayout), sub: "정가 기준 · 할인에 영향 없음" },
    { label: "할인", value: wonShort(discountTotal), sub: "매장이 부담한 금액" },
    { label: "예약 건수", value: `${earning.length}건`, sub: "취소·노쇼 제외" },
    { label: "건당 평균", value: wonShort(avgPerBooking), sub: "손님이 낸 금액 기준" },
  ];

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Revenue</Eyebrow>
          <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">{format(mStart, "yyyy년 M월", { locale: ko })} 매출</h1>
          <div className="mt-0.5 text-[11px] text-mute">
            영업일 기준 ({store.openTime}~익일 {store.closeTime}) · 매장 수익은 예약 1시간당 {won(STORE_FEE_PER_HOUR)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`?month=${prev}`} className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-ink">‹ 이전</Link>
          {!isThisMonth && <Link href={`/${slug}/admin/revenue`} className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-brand">이번 달</Link>}
          <Link href={`?month=${next}`} className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-ink">다음 ›</Link>
        </div>
      </div>

      {/* KPI */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className={cn("p-4", k.strong && "border-brand/40 bg-blush-lt/30")}>
            <div className="text-[11px] font-semibold text-mute">{k.label}</div>
            <div className={cn("mt-1.5 font-serif text-[24px] font-bold", k.strong ? "text-brand" : "text-ink")}>{k.value}</div>
            <div className="mt-1 text-[11px] text-mute">{k.sub}</div>
          </Card>
        ))}
      </div>

      {noshowLoss > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-bad-bg px-4 py-3 text-[12px] text-bad">
          <Chip tone="red">노쇼</Chip>
          노쇼로 놓친 매출 <b>{won(noshowLoss)}</b> — 매출에는 넣지 않았어요.
        </div>
      )}

      {/* 일자별 달력 */}
      <Card className="mt-5 p-5">
        <div className="text-[13px] font-bold text-ink">일자별 매출</div>
        <div className="mt-0.5 text-[11px] text-mute">날짜를 누르면 그날 예약 목록으로 가요. 새벽 예약은 전날 영업일로 잡혀요.</div>
        <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold text-mute">
          {WEEKDAYS_KO.map((d, i) => (
            <div key={d} className={cn("py-1", i === 0 && "text-brand")}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1.5">
          {cells.slice(0, weeks * 7).map((d) => {
            const k = ymd(d);
            const inMonth = d.getMonth() === mStart.getMonth();
            const v = byDay.get(k);
            const revenue = v ? fee(v.hours) : 0;
            const heat = v ? v.hours / peakDayHours : 0;
            const isToday = k === businessDayOf(store, now);
            return (
              <Link
                key={k}
                href={`/${slug}/admin/reservations?view=list&date=${k}`}
                className={cn(
                  "flex min-h-[74px] flex-col rounded-xl border p-1.5 text-left transition-colors hover:border-brand",
                  inMonth ? "border-line bg-card" : "border-transparent bg-transparent opacity-35",
                  isToday && "border-brand",
                )}
                style={v && inMonth ? { background: `rgb(var(--brand-rgb) / ${0.06 + heat * 0.26})` } : undefined}
              >
                <span className={cn("text-[11px] font-bold", isToday ? "text-brand" : "text-ink")}>{d.getDate()}</span>
                {v && inMonth && (
                  <>
                    <span className="mt-auto text-[11px] font-bold text-ink">{wonShort(revenue)}</span>
                    <span className="text-[9px] text-mute">{v.count}건 · {v.hours}시간</span>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        {/* 직원별 */}
        <Card className="p-5">
          <div className="text-[13px] font-bold text-ink">캐치걸별 매출</div>
          <div className="mt-0.5 text-[11px] text-mute">이용 시간이 많은 순 · 고객 결제액은 캐치걸 요금 + 옵션이에요</div>
          {byStaff.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-line py-8 text-center text-[12px] text-mute">이 달 예약이 없어요</div>
          ) : (
            <div className="mt-3">
              <div className="hidden grid-cols-[1.2fr_60px_70px_100px_110px] gap-2 border-b border-line px-1 pb-2 text-[10px] font-semibold text-mute md:grid">
                <span>캐치걸</span><span className="text-right">예약</span><span className="text-right">시간</span><span className="text-right">매장 매출</span><span className="text-right">고객 결제액</span>
              </div>
              {byStaff.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/${slug}/admin/reservations?view=list&staffId=${s.id}`}
                  className="relative grid grid-cols-2 gap-2 border-b border-line px-1 py-2.5 text-[12px] transition-colors hover:bg-blush-lt/30 md:grid-cols-[1.2fr_60px_70px_100px_110px] md:items-center"
                >
                  {/* 시간 비중을 옅은 막대로 */}
                  <span className="absolute inset-y-0 left-0 -z-0 rounded bg-blush-lt/50" style={{ width: `${(s.hours / peakStaffHours) * 100}%` }} />
                  <span className="z-10 col-span-2 flex items-center gap-2 md:col-span-1">
                    <span className="w-3 text-[10px] text-mute">{i + 1}</span>
                    <Avatar src={s.photo} name={s.name} size={24} rounded={8} />
                    <span className="font-bold text-ink">{s.name}</span>
                  </span>
                  <span className="z-10 text-mute md:text-right"><span className="md:hidden">예약 </span>{s.count}건</span>
                  <span className="z-10 text-mute md:text-right"><span className="md:hidden">시간 </span>{s.hours}h</span>
                  <span className="z-10 font-bold text-brand md:text-right">{wonShort(s.storeFee)}</span>
                  <span className="z-10 text-ink md:text-right">{wonShort(s.paid)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          {/* 큰손 */}
          <Card className="p-5">
            <div className="text-[13px] font-bold text-ink">많이 쓴 손님</div>
            <div className="mt-0.5 text-[11px] text-mute">이번 달 결제액 기준 상위 15명</div>
            {spenders.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-line py-8 text-center text-[12px] text-mute">이 달 예약이 없어요</div>
            ) : (
              <div className="mt-3">
                {spenders.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/${slug}/admin/customers/${s.id}`}
                    className="relative flex items-center gap-2 border-b border-line py-2 text-[12px] transition-colors last:border-0 hover:bg-blush-lt/30"
                  >
                    <span className="absolute inset-y-0 left-0 -z-0 rounded bg-blush-lt/50" style={{ width: `${(s.spent / topSpend) * 100}%` }} />
                    <span className="z-10 w-4 text-[10px] text-mute">{i + 1}</span>
                    <span className="z-10 font-bold text-ink">{s.name}</span>
                    <span className="z-10 ml-auto text-mute">{s.visits}건 · {s.hours}h</span>
                    <span className="z-10 w-[72px] text-right font-bold text-brand">{wonShort(s.spent)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* 요일별 */}
          <Card className="p-5">
            <div className="text-[13px] font-bold text-ink">요일별 매출</div>
            <div className="mt-3 flex flex-col gap-1.5">
              {byWeekday.map((d, i) => (
                <div key={d.label} className="flex items-center gap-2 text-[12px]">
                  <span className={cn("w-5 font-semibold", i === 0 ? "text-brand" : "text-mute")}>{d.label}</span>
                  <span className="block h-4 flex-1 overflow-hidden rounded bg-well-2">
                    <span className="block h-full rounded bg-brand/70" style={{ width: `${(d.hours / peakWeekday) * 100}%` }} />
                  </span>
                  <span className="w-[70px] text-right font-semibold text-ink">{wonShort(fee(d.hours))}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 시간대별 */}
          <Card className="p-5">
            <div className="text-[13px] font-bold text-ink">시간대별 매출</div>
            <div className="mt-0.5 text-[11px] text-mute">예약이 시작된 시각 기준</div>
            <div className="mt-3 flex items-end gap-1" style={{ height: 120 }}>
              {byHour.map((h) => (
                <div key={h.label} className="group flex flex-1 flex-col items-center justify-end gap-1" title={`${h.label} · ${won(fee(h.hours))}`}>
                  <span className="block w-full rounded-t bg-brand/70 transition-colors group-hover:bg-brand" style={{ height: `${Math.max(2, (h.hours / peakHour) * 96)}px` }} />
                  <span className="text-[8px] text-mute">{h.label.slice(0, 2)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* 내보내기 — 정산·세무 때 쓰는 기능이라 매출 화면에 둔다 */}
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-bold text-ink">데이터 내보내기</span>
          <PlanBadge plan="MAX" />
          {!canExport && <Chip tone="mute">Max 요금제 기능</Chip>}
        </div>
        <p className="mt-1 text-[11px] leading-[1.8] text-mute">
          {format(mStart, "yyyy년 M월", { locale: ko })} 기준으로 내려받아요. 엑셀에서 바로 열리는 CSV 예요.
          {canExport && " 고객 명단에는 매장이 적어 두신 연락처가 들어 있으니 보관에 주의해 주세요."}
        </p>
        {canExport ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["reservations", "예약 내역", "건별 금액·상태·룸까지"],
              ["staff", "캐치걸 정산", "1인당 시간·매장 몫·캐치걸 몫"],
              ["customers", "고객 명단", "연락처·방문·누적 지출 (기간 전체)"],
            ].map(([t, label, hint]) => (
              <a
                key={t}
                href={`/${slug}/admin/export/${t}?month=${format(mStart, "yyyy-MM")}`}
                className="rounded-2xl border border-line bg-card px-4 py-2.5 transition-colors hover:border-brand"
              >
                <span className="block text-[12px] font-bold text-ink">{label} ↓</span>
                <span className="block text-[10px] text-mute">{hint}</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-well px-4 py-3">
            <span className="text-[11px] text-mute">Max 요금제로 올리시면 예약 내역·캐치걸 정산·고객 명단을 CSV 로 내려받으실 수 있어요.</span>
            <Link href={`/${slug}/admin/plan`} className="text-[11px] font-bold text-brand underline-offset-2 hover:underline">요금제 보기 ›</Link>
          </div>
        )}
      </Card>
    </div>
  );
}
