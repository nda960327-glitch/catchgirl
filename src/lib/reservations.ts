import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ACTIVE_STATUSES, businessDayOf, getSlotsFor, maxHoursAt, MAX_BOOKING_HOURS, shiftOfTime } from "./slots";
import { addMinutes, fmtDateTimeKo, genReservationCode, toLocalDate } from "./utils";
import { notificationService } from "./notifications";

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
  const totalPrice = staff.hourlyPrice * hours + optionsPrice;

  // 그날 그 조에 이 캐치걸이 배치된 룸 — 손님에게 "룸1" 로 안내한다.
  // 이름만 복사해 두므로 나중에 룸이 바뀌거나 지워져도 예약 안내는 그대로 남는다.
  const day = businessDayOf(store, start);
  const shift = shiftOfTime(store, start);
  const assignment = await prisma.shiftAssignment.findFirst({
    where: { staffId: staff.id, date: day, shift },
    include: { room: { select: { name: true } } },
  });
  const roomName = assignment?.room.name ?? null;

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
            totalPrice,
            roomName,
            options: { create: options.map((o) => ({ optionId: o.id, name: o.name, price: o.price })) },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

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
