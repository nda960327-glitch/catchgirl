import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ACTIVE_STATUSES, getSlotsFor } from "./slots";
import { addMinutes, fmtDateTimeKo, genReservationCode, toLocalDate } from "./utils";
import { notificationService } from "./notifications";

export class SlotConflictError extends Error {
  constructor() {
    super("방금 다른 분이 예약했어요. 다른 시간을 골라주세요.");
    this.name = "SlotConflictError";
  }
}

export function slotKey(staffId: string, start: Date, seq: number) {
  return `${staffId}|${start.toISOString()}|${seq}`;
}

export type CreateReservationInput = {
  storeId: string;
  staffId: string;
  customerId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  partySize: number;
  requestNote?: string;
  purposeTag?: string;
  createdBy: "CUSTOMER" | "ADMIN";
  /** 관리자 예약은 과거/마감 슬롯 검증을 건너뛴다 */
  skipAvailabilityCheck?: boolean;
};

/**
 * 예약 생성 — 동시성 제어.
 *  1) 트랜잭션 안에서 해당 슬롯의 활성 예약 수를 센다
 *  2) capacity 미만이면 seq = count 로 slotKey 를 만들어 INSERT
 *  3) 같은 slotKey 가 동시에 들어오면 DB UNIQUE 제약이 막고(P2002) → SlotConflictError
 *
 * Postgres(Supabase) 에서는 1) 직전에
 *   SELECT id FROM "Staff" WHERE id = $1 FOR UPDATE
 * 로 캐치걸 행을 잠그면 count→insert 사이 레이스를 완전히 직렬화할 수 있다.
 * SQLite 는 쓰기 트랜잭션이 전역 직렬화되므로 UNIQUE 제약만으로 충분하다.
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

  const start = toLocalDate(input.date, input.time);
  const end = addMinutes(start, store.slotMinutes);

  if (!input.skipAvailabilityCheck) {
    const slots = await getSlotsFor(store, staff, input.date);
    const s = slots.find((x) => x.time === input.time);
    if (!s || s.status === "off") throw new Error("근무 외 시간이에요.");
    if (s.status === "past") throw new Error("이미 지난 시간이에요.");
    if (s.status === "full") throw new SlotConflictError();
  }

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Staff" WHERE id = ${staff.id} FOR UPDATE`;
        const used = await tx.reservation.count({
          where: { staffId: staff.id, startTime: start, status: { in: ACTIVE_STATUSES } },
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
            partySize: input.partySize,
            requestNote: input.requestNote ?? "",
            purposeTag: input.purposeTag ?? "",
            status: "CONFIRMED",
            createdBy: input.createdBy,
            slotKey: slotKey(staff.id, start, used),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await notificationService().send({
      type: "RESERVATION_CONFIRMED",
      to: customer.phone,
      customerName: customer.nickname,
      staffName: staff.nickname,
      when: fmtDateTimeKo(start),
      code: created.code,
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
    data: { status: "CANCELLED", cancelledAt: new Date(), slotKey: null }, // slotKey 반납 → 자리 즉시 오픈
  });
  await notificationService().send({
    type: "RESERVATION_CANCELLED",
    to: r.customer.phone,
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
      to: r.customer.phone,
      customerName: r.customer.nickname,
      staffName: r.staff.nickname,
      when: fmtDateTimeKo(r.startTime),
      code: r.code,
    });
  }
  return due.length;
}
