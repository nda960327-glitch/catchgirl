import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { requireStaff } from "@/lib/auth";
import { businessDayOf, businessDayRange, getSlotsFor } from "@/lib/slots";
import { cn, startOfDayLocal, STORE_FEE_PER_HOUR, toLocalDate, won, WEEKDAYS_KO, ymd } from "@/lib/utils";
import { Card, Chip, Empty, StatusChip } from "@/components/ui";
import { InstallApp } from "@/components/install-app";

export default async function StaffHome({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ date?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);
  const me = await requireStaff(store.id);
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: me.id }, include: { schedules: true, offs: true } });

  const today = startOfDayLocal(new Date());
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : businessDayOf(store);
  const dayStart = toLocalDate(date, "00:00");
  const range = businessDayRange(store, date);

  // 본인 예약만 조회 (RBAC)
  const [reservations, slots, upcomingCount, myShifts, myOffs] = await Promise.all([
    prisma.reservation.findMany({ where: { staffId: me.id, startTime: { gte: range.start, lt: range.end } }, orderBy: { startTime: "asc" }, include: { customer: true, options: true } }),
    getSlotsFor(store, staff, date),
    prisma.reservation.count({ where: { staffId: me.id, status: "CONFIRMED", startTime: { gte: new Date() } } }),
    prisma.shiftAssignment.findMany({ where: { staffId: me.id, date }, include: { room: { select: { name: true } } } }),
    prisma.staffTimeOff.findMany({ where: { staffId: me.id, date }, orderBy: { startTime: "asc" } }),
  ]);
  const days = Array.from({ length: 14 }, (_, i) => new Date(today.getTime() + i * 86_400_000));
  const offSet = new Set(staff.offs.map((o) => o.date));
  const sched = staff.schedules.filter((s) => s.weekday === dayStart.getDay());
  const isOff = offSet.has(date) || sched.length === 0;
  const active = reservations.filter((r) => r.status !== "CANCELLED");
  // 손님이 할인을 받아도 캐치걸 몫은 줄지 않는다 — 할인은 매장이 부담하므로 정가 기준이다
  const listOf = (r: { totalPrice: number; discountAmount: number }) => r.totalPrice + r.discountAmount;
  const myShare = (r: { totalPrice: number; discountAmount: number; hours: number }) =>
    listOf(r) - r.hours * STORE_FEE_PER_HOUR;

  return (
    <div className="animate-fade">
      <InstallApp role="staff" className="mb-4" />

      <div className="flex items-baseline justify-between">
        <div className="font-serif text-[18px] font-bold text-ink">{format(dayStart, "M월 d일 EEEE", { locale: ko })}</div>
        <div className="text-[11px] text-mute">다가오는 예약 {upcomingCount}건</div>
      </div>

      {/* 오늘 내 자리와 자리 비움 */}
      {(myShifts.length > 0 || myOffs.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-blush-lt/50 px-4 py-3">
          {myShifts.map((a) => (
            <span key={a.id} className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white">
              {a.shift === "DAY" ? "주간" : "야간"} · {a.room.name}
            </span>
          ))}
          {myShifts.length === 0 && <span className="text-[12px] text-mute">이 날은 배치가 없어요</span>}
          {myOffs.map((o) => (
            <span key={o.id} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-mute">
              자리 비움 {o.startTime}~{o.endTime}{o.reason ? ` · ${o.reason}` : ""}
            </span>
          ))}
        </div>
      )}
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
                  {r.options.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.options.map((o) => (
                        <span key={o.id} className="rounded-md bg-blush-lt px-1.5 py-0.5 text-[10px] font-bold text-brand">
                          {o.name} +{won(o.price)}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.requestNote && <div className="mt-1 text-[11px] text-mute">“{r.requestNote}”</div>}
                </div>
                <div className="shrink-0 text-right">
                  <StatusChip status={r.status} />
                  <div className="mt-1.5 font-serif text-[15px] font-bold text-ink">{won(myShare(r))}</div>
                  <div className="text-[10px] text-mute">내 몫</div>
                  {r.discountAmount > 0 && (
                    <div className="text-[10px] text-mute">{r.discountLabel} −{won(r.discountAmount)} (매장 부담)</div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
