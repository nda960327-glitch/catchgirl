import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { getStaffUser } from "@/lib/auth";
import { businessDayOf } from "@/lib/slots";
import { Eyebrow } from "@/components/ui";
import { StaffSettings } from "./staff-settings";

export const dynamic = "force-dynamic";

export default async function StaffSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const me = await getStaffUser(store.id);
  if (!me) redirect(`/${slug}/staff/login`);

  const today = businessDayOf(store);
  const [options, mine, timeOffs, availability] = await Promise.all([
    prisma.storeOption.findMany({ where: { storeId: store.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.staff.findUnique({ where: { id: me.id }, select: { options: { select: { id: true } } } }),
    // 오늘 이후의 자리 비움만 (지난 건 굳이 보여줄 필요가 없다)
    prisma.staffTimeOff.findMany({ where: { staffId: me.id, date: { gte: today } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
    prisma.staffSchedule.findMany({ where: { staffId: me.id }, orderBy: { weekday: "asc" } }),
  ]);

  return (
    <div className="animate-fade px-5 pb-10 pt-5">
      <Eyebrow>My Settings</Eyebrow>
      <h1 className="mt-1 font-serif text-[20px] font-bold text-ink">내 설정</h1>
      <div className="mt-0.5 text-[11px] text-mute">{me.nickname} · 여기서 바꾼 내용은 고객 예약 화면에 바로 반영돼요</div>

      <StaffSettings
        slug={slug}
        today={today}
        storeHours={{ open: store.openTime, close: store.closeTime, split: store.shiftSplitTime }}
        options={options.map((o) => ({ id: o.id, name: o.name, price: o.price }))}
        myOptionIds={(mine?.options ?? []).map((o) => o.id)}
        availability={availability.map((a) => ({ weekday: a.weekday, shift: a.shift as "DAY" | "NIGHT" }))}
        timeOffs={timeOffs.map((t) => ({ id: t.id, date: t.date, startTime: t.startTime, endTime: t.endTime, reason: t.reason, createdBy: t.createdBy }))}
      />
    </div>
  );
}
