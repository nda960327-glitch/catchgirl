import Link from "next/link";
import { format, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { storeSlotTimes } from "@/lib/slots";
import { startOfDayLocal, STATUS_LABEL, parseJsonArray } from "@/lib/utils";
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

  const [todayRes, monthRes, newCustomers, staff] = await Promise.all([
    prisma.reservation.findMany({ where: { storeId: store.id, startTime: { gte: today0, lt: tomorrow0 } }, include: { staff: true, customer: true }, orderBy: { startTime: "asc" } }),
    prisma.reservation.findMany({ where: { storeId: store.id, startTime: { gte: monthAgo, lt: tomorrow0 } }, select: { status: true, startTime: true, staffId: true } }),
    prisma.customer.count({ where: { storeId: store.id, createdAt: { gte: weekAgo } } }),
    prisma.staff.findMany({ where: { storeId: store.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

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

  const kpis = [
    { label: "오늘 예약", value: `${todayActive.length}건`, sub: `${todayRes.filter((r) => r.status === "CONFIRMED" && r.startTime > now).length}건 남음` },
    { label: "오늘 노쇼", value: `${todayNoshow}건`, sub: todayNoshow ? "고객관리에서 확인" : "아직 없어요" },
    { label: "취소율 (30일)", value: `${cancelRate}%`, sub: `${monthRes.length}건 중` },
    { label: "신규 고객 (7일)", value: `${newCustomers}명`, sub: "첫 예약 기준" },
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

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-[11px] font-semibold text-mute">{k.label}</div>
            <div className="mt-1.5 font-serif text-[26px] font-bold text-ink">{k.value}</div>
            <div className="mt-1 text-[11px] text-mute">{k.sub}</div>
          </Card>
        ))}
      </div>

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
          times={storeSlotTimes(store)}
          slotMinutes={store.slotMinutes}
          rows={staff.map((s) => ({
            id: s.id, name: s.nickname, photo: parseJsonArray(s.photos)[0] ?? null,
            items: todayActive.filter((r) => r.staffId === s.id).map((r) => ({ id: r.id, time: format(r.startTime, "HH:mm"), status: r.status, customer: r.customer.nickname, party: r.partySize })),
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
