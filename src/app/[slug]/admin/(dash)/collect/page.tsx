import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { businessDayOf, businessDayRange, shiftOfTime } from "@/lib/slots";
import { resolveRooms } from "@/lib/reservations";
import { cn, SHIFTS, STORE_FEE_PER_HOUR, won, type Shift } from "@/lib/utils";
import { Card, Eyebrow } from "@/components/ui";
import { CollectSheet, type CollectRow } from "./collect-sheet";

export const dynamic = "force-dynamic";

/** 수금 대상 — 취소·노쇼는 받을 돈이 없다 */
const COLLECTIBLE = ["CONFIRMED", "COMPLETED"];

export default async function CollectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);

  const today = businessDayOf(store);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const { start, end } = businessDayRange(store, date);

  const reservations = await prisma.reservation.findMany({
    where: { storeId: store.id, status: { in: COLLECTIBLE }, startTime: { gte: start, lt: end } },
    include: { staff: { select: { id: true, nickname: true } }, customer: { select: { nickname: true } } },
    orderBy: { startTime: "asc" },
  });
  // 룸은 저장값이 아니라 그날 배치를 보고 정한다 — 중간에 방을 옮겼을 수 있다
  const rooms = await resolveRooms(store, reservations);

  const rows: CollectRow[] = reservations.map((r) => {
    // 매장이 받을 돈 = 이용 시간 × 시간당 수수료 − 할인(매장이 부담한 몫)
    const fee = r.hours * STORE_FEE_PER_HOUR;
    return {
      id: r.id,
      code: r.code,
      room: rooms.get(r.id) ?? "자리 미정",
      shift: shiftOfTime(store, r.startTime),
      time: format(r.startTime, "HH:mm"),
      endTime: format(r.endTime, "HH:mm"),
      hours: r.hours,
      staffName: r.staff.nickname,
      customerName: r.customer.nickname,
      fee,
      discount: r.discountAmount,
      discountLabel: r.discountLabel,
      collect: Math.max(0, fee - r.discountAmount),
      status: r.status,
    };
  });

  const sumOf = (shift: Shift) => rows.filter((r) => r.shift === shift).reduce((a, r) => a + r.collect, 0);
  const hoursOf = (shift: Shift) => rows.filter((r) => r.shift === shift).reduce((a, r) => a + r.hours, 0);
  const totals = SHIFTS.map(([shift, label]) => ({
    shift,
    label,
    hours: hoursOf(shift),
    amount: sumOf(shift),
    count: rows.filter((r) => r.shift === shift).length,
  }));
  const grandTotal = rows.reduce((a, r) => a + r.collect, 0);
  const discountTotal = rows.reduce((a, r) => a + Math.min(r.fee, r.discount), 0);

  const shift = (d: string, n: number) => {
    const t = new Date(`${d}T00:00:00`);
    t.setDate(t.getDate() + n);
    return format(t, "yyyy-MM-dd");
  };

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Collect</Eyebrow>
          <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">수금</h1>
          <div className="mt-0.5 text-[11px] text-mute">
            룸을 돌면서 받을 금액이에요. 이용 시간 × {won(STORE_FEE_PER_HOUR)} 에서 할인해 드린 만큼을 뺐어요. 취소·노쇼는 빠져 있어요.
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`?date=${shift(date, -1)}`} className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-mute hover:border-brand">‹</Link>
          <span className="rounded-xl bg-card px-3 py-2 text-[12px] font-bold text-ink shadow-card">
            {format(new Date(`${date}T00:00:00`), "M월 d일 (E)", { locale: ko })}
            {date === today && <span className="ml-1 text-brand">오늘</span>}
          </span>
          <Link href={`?date=${shift(date, 1)}`} className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-mute hover:border-brand">›</Link>
        </div>
      </div>

      {/* 조별 합계 — 주간 먼저 걷고 야간에 다시 돈다 */}
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {totals.map((t) => (
          <Card key={t.shift} className="p-4">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", t.shift === "DAY" ? "bg-gold" : "bg-ink")} />
              <span className="text-[11px] font-semibold text-mute">{t.label}조</span>
            </div>
            <div className="mt-1 font-serif text-[24px] font-bold text-ink">{won(t.amount)}</div>
            <div className="mt-0.5 text-[10px] text-mute">{t.count}건 · {t.hours}시간</div>
          </Card>
        ))}
        <Card className="border-brand/40 bg-blush-lt/50 p-4">
          <div className="text-[11px] font-semibold text-brand">오늘 받을 돈</div>
          <div className="mt-1 font-serif text-[24px] font-bold text-brand">{won(grandTotal)}</div>
          <div className="mt-0.5 text-[10px] text-mute">
            {discountTotal > 0 ? `할인 ${won(discountTotal)} 뺀 금액` : "할인 없음"}
          </div>
        </Card>
      </div>

      <CollectSheet date={date} rows={rows} />
    </div>
  );
}
