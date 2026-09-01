import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { getCustomer } from "@/lib/auth";
import { calendarDays, getSlotsFor } from "@/lib/slots";
import { parseJsonArray } from "@/lib/utils";
import { BookingFlow } from "./booking-flow";

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string; staffId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug, staffId } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, include: { schedules: true, offs: true } });
  if (!staff || staff.storeId !== store.id || !staff.isActive) notFound();
  const me = await getCustomer(store.id);
  const days = calendarDays(store, staff);
  const initialDate = sp.date && days.some((d) => d.date === sp.date && !d.disabled) ? sp.date : (days.find((d) => !d.disabled)?.date ?? days[0].date);
  const [initialSlots, options] = await Promise.all([
    getSlotsFor(store, staff, initialDate),
    prisma.storeOption.findMany({ where: { storeId: store.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <BookingFlow
      slug={slug}
      staff={{ id: staff.id, nickname: staff.nickname, photo: parseJsonArray(staff.photos)[0] ?? null, hourlyPrice: staff.hourlyPrice }}
      store={{ name: store.name, cancelDeadlineHours: store.cancelDeadlineHours, slotMinutes: store.slotMinutes }}
      options={options.map((o) => ({ id: o.id, name: o.name, price: o.price }))}
      days={days}
      initialDate={initialDate}
      initialTime={sp.time ?? null}
      initialSlots={initialSlots}
      customer={me ? { nickname: me.nickname } : null}
    />
  );
}
