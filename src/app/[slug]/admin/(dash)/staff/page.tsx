import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { staffStats } from "@/lib/metrics";
import { parseJsonArray } from "@/lib/utils";
import { Eyebrow } from "@/components/ui";
import { StaffManager, type StaffFull } from "./staff-manager";

export default async function StaffPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { slug } = await params;
  const { edit } = await searchParams;
  const store = await getStoreBySlug(slug);
  const staff = await prisma.staff.findMany({ where: { storeId: store.id }, orderBy: { sortOrder: "asc" }, include: { schedules: { orderBy: { weekday: "asc" } }, offs: { orderBy: { date: "asc" } } } });
  const items: StaffFull[] = await Promise.all(
    staff.map(async (s) => {
      const st = await staffStats(s.id);
      return {
        id: s.id, nickname: s.nickname, bio: s.bio, tags: parseJsonArray(s.tags), photos: parseJsonArray(s.photos),
        isActive: s.isActive, capacityPerSlot: s.capacityPerSlot, loginId: s.loginId ?? "",
        schedules: s.schedules.map((x) => ({ weekday: x.weekday, startTime: x.startTime, endTime: x.endTime })),
        offs: s.offs.map((o) => ({ date: o.date, reason: o.reason ?? "" })),
        stats: { rating: st.rating, reviewCount: st.reviewCount, reservationCount: st.reservationCount, completedCount: st.completedCount, noshowRate: Math.round(st.noshowRate * 100), revisitRate: Math.round(st.revisitRate * 100) },
      };
    }),
  );
  return (
    <div className="animate-fade">
      <Eyebrow>Staff</Eyebrow>
      <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">직원(캐치걸) 관리</h1>
      <StaffManager slug={slug} items={items} storeHours={{ open: store.openTime, close: store.closeTime }} initialEdit={edit} />
    </div>
  );
}
