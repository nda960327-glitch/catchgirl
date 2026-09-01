import Link from "next/link";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { businessDayOf, businessDayRange, storeSlotTimes } from "@/lib/slots";
import { parseJsonArray, toLocalDate, ymd } from "@/lib/utils";
import { Card, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ReservationsClient, type ResRow } from "./reservations-client";

type SP = { view?: string; date?: string; month?: string; staffId?: string; q?: string; status?: string; new?: string; focus?: string };

export default async function ReservationsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);
  const view = sp.view === "calendar" ? "calendar" : "list";
  const staff = await prisma.staff.findMany({ where: { storeId: store.id }, orderBy: { sortOrder: "asc" } });
  const staffLite = staff.map((s) => ({ id: s.id, nickname: s.nickname, isActive: s.isActive }));
  const customers = await prisma.customer.findMany({ where: { storeId: store.id }, select: { id: true, nickname: true }, orderBy: { nickname: "asc" } });

  // ── 리스트 뷰 ── 날짜 필터는 달력 날짜가 아니라 영업일 단위로 자른다
  const todayStr = businessDayOf(store);
  const today = businessDayRange(store, todayStr).start;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : "";
  const dateRange = date ? businessDayRange(store, date) : null;
  const where = {
    storeId: store.id,
    ...(dateRange ? { startTime: { gte: dateRange.start, lt: dateRange.end } } : { startTime: { gte: today } }),
    ...(sp.staffId ? { staffId: sp.staffId } : {}),
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.q ? { customer: { nickname: { contains: sp.q } } } : {}),
  };
  const list = view === "list"
    ? await prisma.reservation.findMany({ where, orderBy: { startTime: "asc" }, include: { staff: true, customer: true, options: true }, take: 200 })
    : [];
  const rows: ResRow[] = list.map((r) => ({
    id: r.id, code: r.code, startTime: r.startTime.toISOString(), date: ymd(r.startTime), time: format(r.startTime, "HH:mm"),
    endLabel: format(r.endTime, "HH:mm"), hours: r.hours, totalPrice: r.totalPrice, optionNames: r.options.map((o) => o.name),
    staffId: r.staffId, staffName: r.staff.nickname, customerId: r.customerId, customerName: r.customer.nickname, memo: r.customer.adminMemo,
    partySize: r.partySize, requestNote: r.requestNote, purposeTag: r.purposeTag, status: r.status, createdBy: r.createdBy, blacklisted: r.customer.isBlacklisted,
  }));

  // ── 캘린더 뷰 ──
  const monthBase = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? toLocalDate(`${sp.month}-01`, "00:00") : startOfMonth(today);
  const mStart = startOfMonth(monthBase);
  const mEnd = endOfMonth(monthBase);
  const monthRes = view === "calendar"
    ? await prisma.reservation.findMany({ where: { storeId: store.id, status: { not: "CANCELLED" }, startTime: { gte: mStart, lte: new Date(mEnd.getTime() + 86_400_000) } }, select: { startTime: true, staffId: true } })
    : [];
  const byDay = new Map<string, Map<string, number>>();
  for (const r of monthRes) {
    const k = ymd(r.startTime);
    const m = byDay.get(k) ?? new Map();
    m.set(r.staffId, (m.get(r.staffId) ?? 0) + 1);
    byDay.set(k, m);
  }
  const gridStart = new Date(mStart.getTime() - mStart.getDay() * 86_400_000);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86_400_000));

  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ view, date, month: sp.month, staffId: sp.staffId, q: sp.q, status: sp.status, ...o })) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Reservations</Eyebrow>
          <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">예약 관리</h1>
        </div>
        <div className="flex rounded-2xl bg-white p-1 shadow-card">
          {(["list", "calendar"] as const).map((v) => (
            <Link key={v} href={qs({ view: v })} className={cn("rounded-xl px-4 py-2 text-[12px] font-bold", view === v ? "bg-brand text-white" : "text-mute")}>
              {v === "list" ? "리스트" : "캘린더"}
            </Link>
          ))}
        </div>
      </div>

      {view === "calendar" ? (
        <Card className="mt-5 p-5">
          <div className="flex items-center justify-between">
            <Link href={qs({ month: format(addMonths(mStart, -1), "yyyy-MM") })} className="rounded-full border border-line px-3 py-1 text-[12px]">‹ 이전</Link>
            <div className="font-serif text-[17px] font-bold text-ink">{format(mStart, "yyyy년 M월", { locale: ko })}</div>
            <Link href={qs({ month: format(addMonths(mStart, 1), "yyyy-MM") })} className="rounded-full border border-line px-3 py-1 text-[12px]">다음 ›</Link>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-mute">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d) => {
              const k = ymd(d);
              const inMonth = d.getMonth() === mStart.getMonth();
              const m = byDay.get(k);
              const total = m ? [...m.values()].reduce((a, b) => a + b, 0) : 0;
              const isToday = k === todayStr;
              return (
                <Link key={k} href={`?view=list&date=${k}`} className={cn("flex min-h-[76px] flex-col rounded-xl border p-1.5 text-left transition-colors hover:border-brand", inMonth ? "border-line bg-white" : "border-transparent bg-transparent opacity-40", isToday && "border-brand bg-blush-lt/40")}>
                  <span className={cn("text-[11px] font-bold", isToday ? "text-brand" : "text-ink")}>{d.getDate()}</span>
                  {total > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {staff.map((s) => {
                        const n = m?.get(s.id);
                        return n ? <span key={s.id} className="rounded-md bg-blush-lt px-1 py-0.5 text-[9px] font-bold text-brand">{s.nickname[0]}{n}</span> : null;
                      })}
                    </div>
                  )}
                  {total > 0 && <span className="mt-auto text-[9px] text-mute">{total}건</span>}
                </Link>
              );
            })}
          </div>
        </Card>
      ) : (
        <ReservationsClient
          slug={slug}
          rows={rows}
          staff={staffLite}
          customers={customers}
          filters={{ date, staffId: sp.staffId ?? "", q: sp.q ?? "", status: sp.status ?? "" }}
          times={storeSlotTimes(store)}
          openNew={sp.new === "1"}
          focusId={sp.focus}
          staffPhotos={Object.fromEntries(staff.map((s) => [s.id, parseJsonArray(s.photos)[0] ?? null]))}
        />
      )}
    </div>
  );
}
