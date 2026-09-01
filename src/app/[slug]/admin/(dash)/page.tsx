import Link from "next/link";
import { format, startOfMonth, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { storeSlotTimes } from "@/lib/slots";
import { startOfDayLocal, STATUS_LABEL, parseJsonArray, ymd, won, wonShort, STORE_FEE_PER_HOUR } from "@/lib/utils";
import { Card, Chip, Eyebrow } from "@/components/ui";
import { Charts } from "./charts";
import { Timeline } from "./timeline";

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const now = new Date();
  const today0 = startOfDayLocal(now);
  const tomorrow0 = new Date(today0.getTime() + 86_400_000);
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

  const todayStr = ymd(now);
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
          <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">{format(now, "M월 d일 EEEE", { locale: ko })}</h1>
        </div>
        <Link href={`/${slug}/admin/reservations?new=1`} className="cta-grad rounded-2xl px-4 py-2.5 text-[13px] font-bold text-white shadow-cta">+ 전화 예약 등록</Link>
      </div>

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
