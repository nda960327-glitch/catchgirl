import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { requireStaff } from "@/lib/auth";
import { getSlotsFor } from "@/lib/slots";
import { cn, startOfDayLocal, toLocalDate, WEEKDAYS_KO, ymd } from "@/lib/utils";
import { Card, Chip, Empty, StatusChip } from "@/components/ui";

export default async function StaffHome({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ date?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);
  const me = await requireStaff(store.id);
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: me.id }, include: { schedules: true, offs: true } });

  const today = startOfDayLocal(new Date());
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : ymd(today);
  const dayStart = toLocalDate(date, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  // 본인 예약만 조회 (RBAC)
  const [reservations, slots, upcomingCount] = await Promise.all([
    prisma.reservation.findMany({ where: { staffId: me.id, startTime: { gte: dayStart, lt: dayEnd } }, orderBy: { startTime: "asc" }, include: { customer: true } }),
    getSlotsFor(store, staff, date),
    prisma.reservation.count({ where: { staffId: me.id, status: "CONFIRMED", startTime: { gte: new Date() } } }),
  ]);
  const days = Array.from({ length: 14 }, (_, i) => new Date(today.getTime() + i * 86_400_000));
  const offSet = new Set(staff.offs.map((o) => o.date));
  const sched = staff.schedules.filter((s) => s.weekday === dayStart.getDay());
  const isOff = offSet.has(date) || sched.length === 0;
  const active = reservations.filter((r) => r.status !== "CANCELLED");

  return (
    <div className="animate-fade">
      <div className="flex items-baseline justify-between">
        <div className="font-serif text-[18px] font-bold text-ink">{format(dayStart, "M월 d일 EEEE", { locale: ko })}</div>
        <div className="text-[11px] text-mute">다가오는 예약 {upcomingCount}건</div>
      </div>
      {/* 날짜 스트립 */}
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => {
          const k = ymd(d);
          const on = k === date;
          const off = offSet.has(k) || !staff.schedules.some((s) => s.weekday === d.getDay());
          return (
            <Link key={k} href={`?date=${k}`} className={cn("flex min-w-[52px] flex-col items-center rounded-2xl border py-2.5", on ? "border-brand bg-brand text-white" : off ? "border-[#F4EDEE] bg-[#F4EDEE] text-[#CDBEC1]" : "border-line bg-white text-ink")}>
              <span className="text-[10px]">{WEEKDAYS_KO[d.getDay()]}</span>
              <span className="mt-0.5 font-serif text-[16px] font-bold">{d.getDate()}</span>
            </Link>
          );
        })}
      </div>

      {/* 근무 스케줄 */}
      <Card className="mt-4 flex items-center gap-3 p-4">
        <div className="flex-1">
          <div className="text-[11px] text-mute">이 날의 근무</div>
          <div className="mt-0.5 text-[14px] font-bold text-ink">{isOff ? (offSet.has(date) ? "휴무" : "근무 없음") : sched.map((s) => `${s.startTime}–${s.endTime}`).join(", ")}</div>
        </div>
        {!isOff && <Chip tone="green">남은 슬롯 {slots.filter((s) => s.status === "open").length}</Chip>}
        <Chip>{active.length}팀 예약</Chip>
      </Card>

      {/* 슬롯 타임라인 */}
      {!isOff && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {slots.map((s) => {
            const r = active.find((x) => format(x.startTime, "HH:mm") === s.time);
            return (
              <div key={s.time} className={cn("flex min-h-[60px] flex-col items-center justify-center rounded-[14px] border px-1 text-center", r ? "border-brand bg-blush-lt" : s.status === "off" ? "border-dashed border-[#E3D3D6] bg-[#FAF6F7] text-[#CDBEC1]" : s.status === "past" ? "border-[#F4EDEE] bg-[#F4EDEE] text-[#CDBEC1]" : "border-line bg-white text-ink")}>
                <span className="text-[12px] font-bold">{s.time}</span>
                {r && <span className="mt-0.5 max-w-full truncate text-[10px] font-semibold text-brand">{r.customer.nickname}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* 예약 리스트 */}
      <div className="mt-6 text-[13px] font-bold text-ink">예약 목록</div>
      {reservations.length === 0 ? (
        <Empty sticker="p6" title="이 날 예약이 없어요" />
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {reservations.map((r) => (
            <Card key={r.id} className={cn("p-3.5 shadow-none", r.status === "CANCELLED" && "opacity-60")}>
              <div className="flex items-center gap-3">
                <div className="w-14">
                  <div className="font-serif text-[16px] font-bold text-ink">{format(r.startTime, "HH:mm")}</div>
                  <div className="text-[10px] text-mute">{r.hours}시간</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-bold text-ink">{r.customer.nickname}</span>
                    {r.customer.adminMemo && <span className="truncate text-[11px] text-mute" title={r.customer.adminMemo}>{r.customer.adminMemo}</span>}
                  </div>
                  {r.requestNote && <div className="mt-1 text-[11px] text-mute">“{r.requestNote}”</div>}
                </div>
                <StatusChip status={r.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
