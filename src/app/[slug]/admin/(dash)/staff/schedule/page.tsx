import Link from "next/link";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { businessDayOf, storeSlotTimes } from "@/lib/slots";
import { parseJsonArray, ymd } from "@/lib/utils";
import { Eyebrow } from "@/components/ui";
import { ScheduleBoard } from "./schedule-board";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
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

  // 이번 주(선택일 기준 일요일부터) 7일 + 다음 주 7일 = 2주치를 미리 짤 수 있게
  const base = new Date(`${date}T00:00:00`);
  const weekStart = new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay());
  const days = Array.from({ length: 14 }, (_, i) => ymd(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)));

  const [rooms, staff, assignments, timeOffs] = await Promise.all([
    prisma.room.findMany({ where: { storeId: store.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
    // 캐치걸이 스스로 알린 "가능한 요일·시간" 을 함께 가져와 배치할 때 참고한다
    prisma.staff.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, nickname: true, photos: true, schedules: { select: { weekday: true, startTime: true, endTime: true } } },
    }),
    prisma.shiftAssignment.findMany({ where: { storeId: store.id, date: { in: days } }, select: { id: true, date: true, shift: true, roomId: true, staffId: true, startTime: true, endTime: true } }),
    prisma.staffTimeOff.findMany({ where: { date: { in: days }, staff: { storeId: store.id } }, select: { id: true, staffId: true, date: true, startTime: true, endTime: true, reason: true, createdBy: true } }),
  ]);

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Shift</Eyebrow>
          <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">출근 · 룸 배치</h1>
          <div className="mt-0.5 text-[11px] text-mute">
            주간 {store.openTime}~{store.shiftSplitTime} · 야간 {store.shiftSplitTime}~익일 {store.closeTime} · 2주치를 미리 짤 수 있어요
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/${slug}/admin/settings#rooms`} className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-bold text-ink">룸 이름·개수 ›</Link>
          <Link href={`/${slug}/admin/staff`} className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-bold text-ink">캐치걸 목록 ›</Link>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line py-10 text-center text-[13px] text-mute">
          아직 룸이 없어요.
          <Link href={`/${slug}/admin/settings`} className="ml-1 font-bold text-brand">매장 설정에서 룸을 먼저 만들어 주세요 ›</Link>
        </div>
      ) : (
        <ScheduleBoard
          slug={slug}
          today={today}
          date={date}
          days={days}
          rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
          staff={staff.map((s) => ({
            id: s.id,
            name: s.nickname,
            photo: parseJsonArray<string>(s.photos)[0] ?? null,
            availableWeekdays: s.schedules.map((x) => x.weekday),
          }))}
          assignments={assignments}
          timeOffs={timeOffs}
          track={storeSlotTimes(store).filter((_, i) => i % (60 / store.slotMinutes) === 0)}
        />
      )}
    </div>
  );
}
