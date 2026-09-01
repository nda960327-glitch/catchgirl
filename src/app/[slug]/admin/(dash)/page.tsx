import Link from "next/link";
import { format, startOfMonth, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { businessDayOf, businessDayRange, storeSlotTimes } from "@/lib/slots";
import { cn, STATUS_LABEL, parseJsonArray, toLocalDate, won, wonShort, STORE_FEE_PER_HOUR } from "@/lib/utils";
import { Card, Chip, Eyebrow } from "@/components/ui";
import { InstallApp } from "@/components/install-app";
import { Charts } from "./charts";
import { Timeline } from "./timeline";

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const now = new Date();
  // "오늘"은 달력 날짜가 아니라 영업일 — 새벽 2시는 아직 어제 시작한 영업일이다
  const todayStr = businessDayOf(store, now);
  const { start: today0, end: tomorrow0 } = businessDayRange(store, todayStr);
  const weekAgo = subDays(today0, 6);
  const monthAgo = subDays(today0, 30);
  const monthStart = startOfMonth(now);

  const [todayRes, monthRes, newCustomers, staff, totalCustomers, thisMonthRes] = await Promise.all([
    prisma.reservation.findMany({
      where: { storeId: store.id, startTime: { gte: today0, lt: tomorrow0 } },
      include: { staff: true, options: true, customer: { include: { reservations: { select: { status: true } } } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.reservation.findMany({ where: { storeId: store.id, startTime: { gte: monthAgo, lt: tomorrow0 } }, select: { status: true, startTime: true, staffId: true } }),
    prisma.customer.count({ where: { storeId: store.id, createdAt: { gte: weekAgo } } }),
    prisma.staff.findMany({ where: { storeId: store.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.customer.count({ where: { storeId: store.id } }),
    prisma.reservation.findMany({ where: { storeId: store.id, startTime: { gte: monthStart, lt: tomorrow0 } }, select: { status: true, hours: true } }),
  ]);

  // 오늘 누가 어느 룸에 출근하는지 + 자리 비운 사람
  const [todayShifts, todayOffs] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where: { storeId: store.id, date: todayStr },
      include: { room: { select: { name: true, sortOrder: true } }, staff: { select: { id: true, nickname: true, photos: true } } },
      orderBy: { room: { sortOrder: "asc" } },
    }),
    prisma.staffTimeOff.findMany({ where: { date: todayStr, staff: { storeId: store.id } }, include: { staff: { select: { id: true, nickname: true } } }, orderBy: { startTime: "asc" } }),
  ]);
  const awayByStaff = new Map<string, typeof todayOffs>();
  for (const o of todayOffs) awayByStaff.set(o.staffId, [...(awayByStaff.get(o.staffId) ?? []), o]);

  // 매장 수익 = 예약된 시간 × 시간당 정액 (캐치걸에게 가는 요금과는 별개)
  const hoursOf = (statuses: string[]) => thisMonthRes.filter((r) => statuses.includes(r.status)).reduce((a, r) => a + r.hours, 0);
  const doneHours = hoursOf(["COMPLETED"]);
  const bookedHours = hoursOf(["COMPLETED", "CONFIRMED"]);
  const revenueDone = doneHours * STORE_FEE_PER_HOUR;
  const revenueBooked = bookedHours * STORE_FEE_PER_HOUR;

  const todayActive = todayRes.filter((r) => r.status !== "CANCELLED");
  const todayNoshow = todayRes.filter((r) => r.status === "NOSHOW").length;
  const cancelRate = monthRes.length ? Math.round((monthRes.filter((r) => r.status === "CANCELLED").length / monthRes.length) * 100) : 0;

  // 주간 추이 (최근 7일, 취소 제외)
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today0, 6 - i);
    const next = new Date(d.getTime() + 86_400_000);
    const n = monthRes.filter((r) => r.status !== "CANCELLED" && r.startTime >= d && r.startTime < next).length;
    return { day: format(d, "M/d (EEE)", { locale: ko }), count: n };
  });
  // 캐치걸별 점유율 (30일, 취소 제외)
  const share = staff.map((s) => ({ name: s.nickname, count: monthRes.filter((r) => r.status !== "CANCELLED" && r.staffId === s.id).length }));

  // 각 지표는 그 숫자를 만든 목록으로 바로 넘어간다
  const kpis = [
    { label: `${format(now, "M월")} 매출`, value: wonShort(revenueDone), sub: `방문완료 ${doneHours}시간 · 예정 포함 ${wonShort(revenueBooked)}`, href: `/${slug}/admin/reservations?view=list` },
    { label: "총 고객", value: `${totalCustomers}명`, sub: `최근 7일 신규 ${newCustomers}명`, href: `/${slug}/admin/customers` },
    { label: "오늘 예약", value: `${todayActive.length}건`, sub: `${todayRes.filter((r) => r.status === "CONFIRMED" && r.startTime > now).length}건 남음`, href: `/${slug}/admin/reservations?view=list&date=${todayStr}` },
    { label: "오늘 노쇼", value: `${todayNoshow}건`, sub: todayNoshow ? "눌러서 확인" : "아직 없어요", href: `/${slug}/admin/reservations?view=list&date=${todayStr}&status=NOSHOW` },
    { label: "취소율 (30일)", value: `${cancelRate}%`, sub: `${monthRes.length}건 중`, href: `/${slug}/admin/reservations?view=list&status=CANCELLED` },
  ];

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Dashboard</Eyebrow>
          <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">{format(toLocalDate(todayStr, "00:00"), "M월 d일 EEEE", { locale: ko })}</h1>
          <div className="mt-0.5 text-[11px] text-mute">영업일 기준 · {store.openTime}~익일 {store.closeTime}</div>
        </div>
        <Link href={`/${slug}/admin/reservations?new=1`} className="cta-grad rounded-2xl px-4 py-2.5 text-[13px] font-bold text-white shadow-cta">+ 전화 예약 등록</Link>
      </div>

      <InstallApp role="admin" className="mt-4" />

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="block">
            <Card className="group p-4 transition-all hover:border-brand hover:shadow-pop">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-mute">{k.label}</span>
                <span className="text-[12px] text-blush transition-transform group-hover:translate-x-0.5">›</span>
              </div>
              <div className="mt-1.5 font-serif text-[26px] font-bold text-ink">{k.value}</div>
              <div className="mt-1 text-[11px] text-mute">{k.sub}</div>
            </Card>
          </Link>
        ))}
      </div>

      {/* 오늘 출근 — 누가 어느 룸인지, 지금 나가 있는 사람은 누구인지 */}
      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[13px] font-bold text-ink">오늘 출근</div>
            <div className="mt-0.5 text-[11px] text-mute">
              주간 {store.openTime}~{store.shiftSplitTime} · 야간 {store.shiftSplitTime}~익일 {store.closeTime}
            </div>
          </div>
          <Link href={`/${slug}/admin/staff/schedule?date=${todayStr}`} className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-bold text-brand">배치 짜기 ›</Link>
        </div>

        {todayShifts.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line py-7 text-center text-[12px] text-mute">
            오늘 배치가 아직 없어요.
            <Link href={`/${slug}/admin/staff/schedule?date=${todayStr}`} className="ml-1 font-bold text-brand">지금 짜기 ›</Link>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(["DAY", "NIGHT"] as const).map((shift) => {
              const list = todayShifts.filter((a) => a.shift === shift);
              return (
                <div key={shift} className="rounded-2xl bg-[#FAF6F7] p-3">
                  <div className="flex items-center gap-1.5 px-1">
                    <span className={cn("h-2 w-2 rounded-full", shift === "DAY" ? "bg-gold" : "bg-ink")} />
                    <span className="text-[12px] font-bold text-ink">{shift === "DAY" ? "주간" : "야간"}조</span>
                    <span className="text-[11px] text-mute">{list.length}명</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {list.length === 0 && <span className="px-1 text-[11px] text-mute">배치 없음</span>}
                    {list.map((a) => {
                      const away = awayByStaff.get(a.staffId) ?? [];
                      return (
                        <span key={a.id} className={cn("flex items-center gap-1.5 rounded-full border bg-white px-2 py-1 text-[11px]", away.length ? "border-[#E8C7C7]" : "border-line")}>
                          <span className="font-bold text-brand">{a.room.name}</span>
                          <span className="font-semibold text-ink">{a.staff.nickname}</span>
                          {away.length > 0 && <span className="text-[10px] font-bold text-[#C0392B]">외출 {away[0].startTime}~{away[0].endTime}</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {todayOffs.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[#FDECEC] px-4 py-3 text-[12px] text-[#C0392B]">
            <Chip tone="red">자리 비움</Chip>
            {todayOffs.map((o) => (
              <span key={o.id}>
                <b>{o.staff.nickname}</b> {o.startTime}~{o.endTime}
                {o.reason ? ` (${o.reason})` : ""}
                <span className="ml-1 text-[10px] opacity-70">{o.createdBy === "ADMIN" ? "매장" : "본인"}</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* 매출 근거 — 숫자가 어디서 나왔는지 바로 보이게 */}
      <Card className="mt-5 p-5">
        <div className="text-[13px] font-bold text-ink">{format(now, "M월")} 매출 상세</div>
        <div className="mt-0.5 text-[11px] text-mute">예약 1시간당 {won(STORE_FEE_PER_HOUR)} 기준</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { k: "방문완료", h: doneHours, v: revenueDone, tone: "text-ink" },
            { k: "예정(확정)", h: bookedHours - doneHours, v: revenueBooked - revenueDone, tone: "text-mute" },
            { k: "합계", h: bookedHours, v: revenueBooked, tone: "text-brand" },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-[#FAF6F7] px-4 py-3">
              <div className="text-[11px] text-mute">{x.k} · {x.h}시간</div>
              <div className={`mt-0.5 font-serif text-[18px] font-bold ${x.tone}`}>{won(x.v)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-ink">오늘의 타임라인</div>
            <div className="mt-0.5 text-[11px] text-mute">캐치걸 × 시간대 예약 현황</div>
          </div>
          <div className="flex gap-2 text-[10px]">
            <Chip tone="brand">확정</Chip><Chip tone="green">완료</Chip><Chip tone="red">노쇼</Chip>
          </div>
        </div>
        <Timeline
          slug={slug}
          times={storeSlotTimes(store)}
          slotMinutes={store.slotMinutes}
          rows={staff.map((s) => ({
            id: s.id,
            name: s.nickname,
            photo: parseJsonArray(s.photos)[0] ?? null,
            items: todayActive
              .filter((r) => r.staffId === s.id)
              .map((r) => ({
                id: r.id,
                code: r.code,
                time: format(r.startTime, "HH:mm"),
                endTime: format(r.endTime, "HH:mm"),
                hours: r.hours,
                status: r.status,
                requestNote: r.requestNote,
                totalPrice: r.totalPrice,
                optionNames: r.options.map((o) => o.name),
                createdBy: r.createdBy,
                customerId: r.customerId,
                customer: r.customer.nickname,
                customerMemo: r.customer.adminMemo,
                customerVisits: r.customer.reservations.filter((x) => x.status === "COMPLETED").length,
                customerNoshows: r.customer.reservations.filter((x) => x.status === "NOSHOW").length,
                blacklisted: r.customer.isBlacklisted,
              })),
          }))}
          nowTime={format(now, "HH:mm")}
        />
      </Card>

      <Charts weekly={weekly} share={share} />

      <Card className="mt-5 p-5">
        <div className="text-[13px] font-bold text-ink">오늘 예약 목록</div>
        <div className="mt-3 divide-y divide-line">
          {todayRes.length === 0 && <div className="py-6 text-center text-[12px] text-mute">오늘 예약이 없어요</div>}
          {todayRes.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2.5 text-[12px]">
              <span className="w-12 font-bold text-ink">{format(r.startTime, "HH:mm")}</span>
              <span className="w-14 text-mute">{r.staff.nickname}</span>
              <span className="flex-1 truncate text-ink">{r.customer.nickname}{r.requestNote && <span className="text-mute"> · {r.requestNote}</span>}</span>
              <Chip tone={r.status === "CONFIRMED" ? "brand" : r.status === "COMPLETED" ? "green" : r.status === "NOSHOW" ? "red" : "mute"}>{STATUS_LABEL[r.status]}</Chip>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
