import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { previewDiscounts } from "@/lib/discounts";
import { getStoreBySlug } from "@/lib/store";
import { getCustomer } from "@/lib/auth";
import { calendarDays, getSlotsFor } from "@/lib/slots";
import { parseJsonArray } from "@/lib/utils";
import { BookingFlow } from "./booking-flow";

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string; staffId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug, staffId } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.storeId !== store.id || !staff.isActive) notFound();
  const me = await getCustomer(store.id);
  const days = await calendarDays(store, staff);
  const initialDate = sp.date && days.some((d) => d.date === sp.date && !d.disabled) ? sp.date : (days.find((d) => !d.disabled)?.date ?? days[0].date);
  const [initialSlots, options] = await Promise.all([
    getSlotsFor(store, staff, initialDate),
    prisma.storeOption.findMany({ where: { storeId: store.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  // 로그인한 손님에게만 할인이 붙는다 — 등급도 쿠폰도 계정에 딸린 값이라
  const discounts = me ? await previewDiscounts(store.id, me.id, initialDate) : null;
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
      autoDiscount={discounts?.auto ?? null}
      coupons={(discounts?.coupons ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        amount: c.amount,
        expiresAt: c.expiresAt ? format(c.expiresAt, "yyyy.MM.dd") : null,
      }))}
    />
  );
}
