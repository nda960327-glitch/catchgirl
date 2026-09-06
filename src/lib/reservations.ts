import "server-only";
import { Prisma, type Store } from "@prisma/client";
import { prisma } from "./db";
import { ACTIVE_STATUSES, businessDayOf, getSlotsFor, maxHoursAt, MAX_BOOKING_HOURS, shiftOfTime } from "./slots";
import { addMinutes, fmtDateTimeKo, genReservationCode, toLocalDate } from "./utils";
import { notificationService } from "./notifications";
import { gradeBenefitFor, gradeOfCustomer, promotionOn, resolveDiscount } from "./discounts";

/**
 * 예약들이 실제로 앉을 룸을 찾아준다.
 *
 * 예약할 때 저장해 둔 roomName 만 믿으면, 배치를 나중에 짜거나 중간에 방을 옮겼을 때
 * 손님이 엉뚱한 자리를 안내받는다. 그래서 그날 그 조의 배치를 먼저 보고,
 * 배치가 없을 때만 예약 당시 값으로 되돌아간다.
 */
export async function resolveRooms(
  store: Pick<Store, "openTime" | "closeTime" | "shiftSplitTime">,
  reservations: { id: string; staffId: string; startTime: Date; roomName: string | null }[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (reservations.length === 0) return out;

  const keyed = reservations.map((r) => ({ ...r, date: businessDayOf(store, r.startTime) }));
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      staffId: { in: [...new Set(keyed.map((r) => r.staffId))] },
      date: { in: [...new Set(keyed.map((r) => r.date))] },
      // 예비로 걸어 둔 자리는 실제 근무가 아니라 안내할 룸이 아니다
      isStandby: false,
    },
    include: { room: { select: { name: true } } },
  });

  // 배치가 실제 시각을 갖고 있으므로, 예약 시작 시각을 품는 배치를 찾는다
  const openMin = timeToMin(store.openTime);
  const norm = (m: number) => (m < openMin ? m + 24 * 60 : m);
  for (const r of keyed) {
    const t = norm(r.startTime.getHours() * 60 + r.startTime.getMinutes());
    const hit = assignments.find((a) => {
      if (a.staffId !== r.staffId || a.date !== r.date) return false;
      const s = norm(timeToMin(a.startTime));
      const e0 = norm(timeToMin(a.endTime));
      const e = e0 <= s ? e0 + 24 * 60 : e0;
      return t >= s && t < e;
    });
    out.set(r.id, hit?.room.name ?? r.roomName);
  }
  return out;
}

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export class SlotConflictError extends Error {
  constructor() {
    super("방금 다른 분이 예약했어요. 다른 시간을 골라주세요.");
    this.name = "SlotConflictError";
  }
}

export type CreateReservationInput = {
  storeId: string;
  staffId: string;
  customerId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  hours?: number; // 이용 시간 (1시간 단위, 기본 1)
  optionIds?: string[];
  partySize: number;
  requestNote?: string;
  purposeTag?: string;
  createdBy: "CUSTOMER" | "ADMIN";
  /** 손님이 고른 쿠폰 (없으면 자동 할인만 붙는다) */
  couponId?: string;
  /** 관리자 예약은 과거/마감 슬롯 검증을 건너뛴다 */
  skipAvailabilityCheck?: boolean;
};

/**
 * 예약 생성 — 동시성 제어.
 *  1) 트랜잭션 안에서 Staff 행을 FOR UPDATE 로 잠가 같은 캐치걸에 대한 예약을 직렬화한다
 *  2) 요청 구간과 겹치는 활성 예약 수를 센다
 *  3) capacity 미만이면 INSERT
 *
 * 구간 예약이라 slotKey UNIQUE 로는 막을 수 없다 (겹치는 방식이 여러 가지). 행 잠금이 유일한 방어선.
 */
export async function createReservation(input: CreateReservationInput) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: input.storeId } });
  const staff = await prisma.staff.findUniqueOrThrow({
    where: { id: input.staffId },
    include: { schedules: true },
  });
  if (staff.storeId !== store.id) throw new Error("INVALID_STAFF");
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: input.customerId } });
  if (customer.isBlacklisted && input.createdBy === "CUSTOMER") {
    throw new Error("예약이 제한된 계정이에요. 매장에 문의해 주세요.");
  }

  const hours = Math.max(1, Math.min(MAX_BOOKING_HOURS, Math.floor(input.hours ?? 1)));
  const start = toLocalDate(input.date, input.time);
  const end = addMinutes(start, hours * 60);

  if (!input.skipAvailabilityCheck) {
    const slots = await getSlotsFor(store, staff, input.date);
    const i = slots.findIndex((x) => x.time === input.time);
    const s = i >= 0 ? slots[i] : undefined;
    if (!s || s.status === "off") throw new Error("근무 외 시간이에요.");
    if (s.status === "past") throw new Error("이미 지난 시간이에요.");
    if (s.status === "full") throw new SlotConflictError();
    const max = maxHoursAt(slots, i, store.slotMinutes);
    if (hours > max) {
      throw new Error(max === 0 ? "이 시간은 예약할 수 없어요." : `이 시간부터는 최대 ${max}시간까지 예약할 수 있어요.`);
    }
  }

  // 옵션은 예약 1건당 1회 부과. 이름·가격은 지금 값을 복사해 둔다.
  // 캐치걸이 제공하지 않는 옵션은 걸러낸다 (옵션을 연결해 두지 않았으면 전부 허용).
  const linkedOptions = await prisma.storeOption.findMany({ where: { staff: { some: { id: staff.id } } }, select: { id: true } });
  const allowed = new Set(linkedOptions.map((o) => o.id));
  const wanted = (input.optionIds ?? []).filter((id) => allowed.size === 0 || allowed.has(id));
  const options = wanted.length
    ? await prisma.storeOption.findMany({ where: { id: { in: wanted }, storeId: store.id, isActive: true } })
    : [];
  const optionsPrice = options.reduce((a, o) => a + o.price, 0);
  const listPrice = staff.hourlyPrice * hours + optionsPrice;

  // 그날 그 조에 이 캐치걸이 배치된 룸 — 손님에게 "룸1" 로 안내한다.
  // 이름만 복사해 두므로 나중에 룸이 바뀌거나 지워져도 예약 안내는 그대로 남는다.
  const day = businessDayOf(store, start);
  const shift = shiftOfTime(store, start);
  const assignment = await prisma.shiftAssignment.findFirst({
    where: { staffId: staff.id, date: day, shift, isStandby: false },
    include: { room: { select: { name: true } } },
  });
  const roomName = assignment?.room.name ?? null;

  // 할인 — 매장이 부담하므로 캐치걸 몫(정가)에는 손대지 않는다.
  // 쿠폰은 예약 생성이 성공한 뒤에 사용 처리한다.
  const grade = await gradeOfCustomer(customer.id);
  const [benefit, promo] = await Promise.all([gradeBenefitFor(store.id, grade), promotionOn(store.id, day)]);
  const auto = [benefit, promo].filter((d): d is { label: string; amount: number } => d !== null).sort((a, b) => b.amount - a.amount)[0] ?? null;
  const chosen = input.couponId
    ? await prisma.coupon.findFirst({
        where: {
          id: input.couponId,
          storeId: store.id,
          customerId: customer.id,
          usedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      })
    : null;
  const discount = resolveDiscount(listPrice, auto, chosen ? { label: chosen.name, amount: chosen.amount } : null);
  const totalPrice = listPrice - discount.amount;

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Staff" WHERE id = ${staff.id} FOR UPDATE`;
        // [start, end) 와 겹치는 예약: 기존 시작 < 요청 끝 AND 기존 끝 > 요청 시작
        const used = await tx.reservation.count({
          where: {
            staffId: staff.id,
            status: { in: ACTIVE_STATUSES },
            startTime: { lt: end },
            endTime: { gt: start },
          },
        });
        if (used >= staff.capacityPerSlot) throw new SlotConflictError();
        let code = genReservationCode(start);
        // 예약번호 충돌 방지
        while (await tx.reservation.findUnique({ where: { code } })) code = genReservationCode(start);
        return tx.reservation.create({
          data: {
            code,
            storeId: store.id,
            staffId: staff.id,
            customerId: customer.id,
            startTime: start,
            endTime: end,
            hours,
            partySize: input.partySize,
            requestNote: input.requestNote ?? "",
            purposeTag: input.purposeTag ?? "",
            status: "CONFIRMED",
            createdBy: input.createdBy,
            hourlyPrice: staff.hourlyPrice,
            optionsPrice,
            discountAmount: discount.amount,
            discountLabel: discount.label,
            totalPrice,
            roomName,
            options: { create: options.map((o) => ({ optionId: o.id, name: o.name, price: o.price })) },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // 예약이 실제로 잡힌 뒤에만 쿠폰을 쓴 것으로 처리한다.
    // 조건에 usedAt: null 을 남겨 두어 동시에 두 예약에 쓰이지 않게 한다.
    if (chosen) {
      await prisma.coupon.updateMany({
        where: { id: chosen.id, usedAt: null },
        data: { usedAt: new Date(), reservationId: created.id },
      });
    }

    await notificationService().send({
      type: "RESERVATION_CONFIRMED",
      customerName: customer.nickname,
      staffName: staff.nickname,
      when: fmtDateTimeKo(start),
      code: created.code,
      roomName,
    });
    return created;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new SlotConflictError();
    }
    throw e;
  }
}

export async function cancelReservation(reservationId: string, by: "CUSTOMER" | "ADMIN" | "STAFF") {
  const r = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: { customer: true, staff: true, store: true },
  });
  if (r.status !== "CONFIRMED") throw new Error("이미 처리된 예약이에요.");
  if (by === "CUSTOMER") {
    const deadline = addMinutes(r.startTime, -r.store.cancelDeadlineHours * 60);
    if (new Date() > deadline) {
      throw new Error(`방문 ${r.store.cancelDeadlineHours}시간 전까지만 취소할 수 있어요. 매장으로 연락해 주세요.`);
    }
  }
  const updated = await prisma.reservation.update({
    where: { id: r.id },
    data: { status: "CANCELLED", cancelledAt: new Date() }, // 취소 상태는 점유에서 빠져 자리가 즉시 열린다
  });
  await notificationService().send({
    type: "RESERVATION_CANCELLED",
    customerName: r.customer.nickname,
    staffName: r.staff.nickname,
    when: fmtDateTimeKo(r.startTime),
    code: r.code,
  });
  return updated;
}

/** 방문 1시간 전 리마인드 — 실제 스케줄러 대신 요청 시점에 호출하는 단순 트리거 (MVP) */
export async function sendDueReminders() {
  const now = new Date();
  const from = addMinutes(now, 55);
  const to = addMinutes(now, 65);
  const due = await prisma.reservation.findMany({
    where: { status: "CONFIRMED", startTime: { gte: from, lte: to } },
    include: { customer: true, staff: true },
  });
  for (const r of due) {
    await notificationService().send({
      type: "REMINDER_1H",
      customerName: r.customer.nickname,
      staffName: r.staff.nickname,
      when: fmtDateTimeKo(r.startTime),
      code: r.code,
      roomName: r.roomName,
    });
  }
  return due.length;
}
