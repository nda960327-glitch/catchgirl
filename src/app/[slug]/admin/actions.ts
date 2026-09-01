"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clearSession, requireAdmin, setSession } from "@/lib/auth";
import { getStoreBySlug } from "@/lib/store";
import { cancelReservation, createReservation, sendDueReminders, SlotConflictError } from "@/lib/reservations";
import { ymd } from "@/lib/utils";

export type R<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (e: unknown, fallback = "처리에 실패했어요."): R<never> => ({ ok: false, error: e instanceof Error && e.message !== "UNAUTHORIZED" ? e.message : e instanceof Error ? "권한이 없어요." : fallback });

/* ─── 로그인 ─── */
export async function loginAdmin(slug: string, form: FormData, next?: string): Promise<R> {
  const store = await getStoreBySlug(slug);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || admin.storeId !== store.id || !(await bcrypt.compare(password, admin.passwordHash))) {
    return { ok: false, error: "이메일 또는 비밀번호가 맞지 않아요." };
  }
  await setSession({ role: "admin", id: admin.id, storeId: store.id, name: admin.name });
  redirect(next && next.startsWith(`/${slug}/admin`) ? next : `/${slug}/admin`);
}
export async function logoutAdmin(slug: string) {
  await clearSession("admin");
  redirect(`/${slug}/admin/login`);
}

/* ─── 예약 관리 ─── */
export async function adminSetReservationStatus(slug: string, id: string, status: "COMPLETED" | "NOSHOW" | "CANCELLED" | "CONFIRMED"): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const r = await prisma.reservation.findUnique({ where: { id } });
    if (!r || r.storeId !== store.id) return { ok: false, error: "예약을 찾을 수 없어요." };
    if (status === "CANCELLED") await cancelReservation(id, "ADMIN");
    else await prisma.reservation.update({ where: { id }, data: { status, cancelledAt: null } });
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const adminBook = z.object({
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  hours: z.coerce.number().int().min(1).max(8).default(1),
  partySize: z.coerce.number().int().min(1).max(20),
  requestNote: z.string().trim().max(200).optional().default(""),
  nickname: z.string().trim().max(12).optional().default(""),
  customerId: z.string().optional(),
});
export async function adminCreateReservation(slug: string, input: z.input<typeof adminBook>): Promise<R<{ id: string }>> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const p = adminBook.safeParse(input);
    if (!p.success) return { ok: false, error: "입력값을 확인해 주세요." };
    let customerId = p.data.customerId;
    if (!customerId) {
      if (!p.data.nickname) return { ok: false, error: "닉네임을 입력해 주세요." };
      // 전화로 받은 예약 — PIN 없이 만들어 두고, 고객이 같은 닉네임으로 처음 로그인할 때 넘겨받는다
      const c = await prisma.customer.upsert({
        where: { storeId_nickname: { storeId: store.id, nickname: p.data.nickname } },
        update: {},
        create: { storeId: store.id, nickname: p.data.nickname },
      });
      customerId = c.id;
    }
    const r = await createReservation({
      storeId: store.id, staffId: p.data.staffId, customerId, date: p.data.date, time: p.data.time, hours: p.data.hours,
      partySize: p.data.partySize, requestNote: p.data.requestNote, purposeTag: "전화예약", createdBy: "ADMIN", skipAvailabilityCheck: true,
    });
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    if (e instanceof SlotConflictError) return { ok: false, error: "해당 슬롯은 이미 가득 찼어요." };
    return fail(e);
  }
}

export async function adminUpdateReservation(slug: string, id: string, data: { partySize?: number; requestNote?: string; date?: string; time?: string; staffId?: string; hours?: number }): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const r = await prisma.reservation.findUnique({ where: { id } });
    if (!r || r.storeId !== store.id) return { ok: false, error: "예약을 찾을 수 없어요." };
    // 일시/캐치걸/이용시간 변경은 새 예약 생성 + 기존 취소로 처리 (겹침 검사를 한 곳에서만 하도록)
    if ((data.date && data.time) || data.staffId || (data.hours && data.hours !== r.hours)) {
      const date = data.date ?? ymd(r.startTime);
      const time = data.time ?? `${String(r.startTime.getHours()).padStart(2, "0")}:${String(r.startTime.getMinutes()).padStart(2, "0")}`;
      await prisma.reservation.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await createReservation({
        storeId: store.id, staffId: data.staffId ?? r.staffId, customerId: r.customerId, date, time,
        hours: data.hours ?? r.hours,
        partySize: data.partySize ?? r.partySize, requestNote: data.requestNote ?? r.requestNote, purposeTag: r.purposeTag, createdBy: "ADMIN", skipAvailabilityCheck: true,
      });
    } else {
      await prisma.reservation.update({ where: { id }, data: { partySize: data.partySize ?? r.partySize, requestNote: data.requestNote ?? r.requestNote } });
    }
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof SlotConflictError) return { ok: false, error: "해당 슬롯은 이미 가득 찼어요." };
    return fail(e);
  }
}

/* ─── 직원 관리 ─── */
const staffSchema = z.object({
  id: z.string().optional(),
  nickname: z.string().trim().min(1).max(10),
  bio: z.string().trim().max(300).optional().default(""),
  tags: z.array(z.string().trim().min(1).max(12)).max(8).default([]),
  photos: z.array(z.string()).max(10).default([]),
  isActive: z.boolean().default(true),
  capacityPerSlot: z.coerce.number().int().min(1).max(10).default(1),
  hourlyPrice: z.coerce.number().int().min(0).max(100_000_000).default(300_000),
  adminMemo: z.string().max(500).optional().default(""),
  optionIds: z.array(z.string()).max(20).optional().default([]),
  loginId: z.string().trim().max(30).optional().default(""),
  password: z.string().max(50).optional().default(""),
  schedules: z.array(z.object({ weekday: z.number().int().min(0).max(6), startTime: z.string(), endTime: z.string() })).default([]),
  offs: z.array(z.object({ date: z.string(), reason: z.string().optional().default("") })).default([]),
});
export async function saveStaff(slug: string, input: z.input<typeof staffSchema>): Promise<R<{ id: string }>> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const p = staffSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const d = p.data;
    const base = {
      nickname: d.nickname, bio: d.bio, tags: JSON.stringify(d.tags), photos: JSON.stringify(d.photos),
      isActive: d.isActive, capacityPerSlot: d.capacityPerSlot, hourlyPrice: d.hourlyPrice, adminMemo: d.adminMemo, loginId: d.loginId || null,
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
    };
    const optionIds = d.optionIds.map((oid) => ({ id: oid }));
    let id = d.id;
    if (id) {
      const ex = await prisma.staff.findUnique({ where: { id } });
      if (!ex || ex.storeId !== store.id) return { ok: false, error: "캐치걸를 찾을 수 없어요." };
      // set 은 수정할 때만 쓸 수 있다 (생성 시엔 connect)
      await prisma.staff.update({ where: { id }, data: { ...base, options: { set: optionIds } } });
    } else {
      const count = await prisma.staff.count({ where: { storeId: store.id } });
      const created = await prisma.staff.create({ data: { ...base, storeId: store.id, sortOrder: count, options: { connect: optionIds } } });
      id = created.id;
    }
    await prisma.$transaction([
      prisma.staffSchedule.deleteMany({ where: { staffId: id } }),
      prisma.staffSchedule.createMany({ data: d.schedules.map((s) => ({ ...s, staffId: id! })) }),
      prisma.staffOff.deleteMany({ where: { staffId: id } }),
      prisma.staffOff.createMany({ data: d.offs.filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.date)).map((o) => ({ staffId: id!, date: o.date, reason: o.reason || null })) }),
    ]);
    revalidatePath(`/${slug}`, "layout");
    return { ok: true, data: { id } };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) return { ok: false, error: "이미 사용 중인 로그인 ID예요." };
    return fail(e);
  }
}

/** 캐치걸 삭제 전 미리보기 — 같이 지워지는 것들을 UI 가 먼저 보여줄 수 있게 */
export async function staffDeletionImpact(slug: string, staffId: string): Promise<R<{ nickname: string; reservations: number; reviews: number }>> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const s = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!s || s.storeId !== store.id) return { ok: false, error: "캐치걸를 찾을 수 없어요." };
    const [reservations, reviews] = await Promise.all([
      prisma.reservation.count({ where: { staffId } }),
      prisma.review.count({ where: { staffId } }),
    ]);
    return { ok: true, data: { nickname: s.nickname, reservations, reviews } };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 캐치걸 삭제 — 예약·후기·댓글·찜·추천이 함께 사라진다 (스키마상 Cascade).
 * 매출 이력까지 지워지므로, 잠시 안 나오는 것뿐이라면 '비활성'을 쓰는 편이 낫다.
 */
export async function deleteStaff(slug: string, staffId: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const s = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!s || s.storeId !== store.id) return { ok: false, error: "캐치걸를 찾을 수 없어요." };
    await prisma.staff.delete({ where: { id: staffId } });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── 룸 · 출근 배치 ─── */
const roomSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "룸 이름을 입력해 주세요").max(20),
  isActive: z.boolean().default(true),
});
export async function saveRoom(slug: string, input: z.input<typeof roomSchema>): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const p = roomSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const d = p.data;
    if (d.id) {
      const ex = await prisma.room.findUnique({ where: { id: d.id } });
      if (!ex || ex.storeId !== store.id) return { ok: false, error: "룸을 찾을 수 없어요." };
      await prisma.room.update({ where: { id: d.id }, data: { name: d.name, isActive: d.isActive } });
    } else {
      const count = await prisma.room.count({ where: { storeId: store.id } });
      await prisma.room.create({ data: { storeId: store.id, name: d.name, isActive: d.isActive, sortOrder: count } });
    }
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) return { ok: false, error: "같은 이름의 룸이 이미 있어요." };
    return fail(e);
  }
}

/** 룸 삭제 — 그 룸에 잡혀 있던 배치도 함께 사라진다 */
export async function deleteRoom(slug: string, roomId: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const r = await prisma.room.findUnique({ where: { id: roomId } });
    if (!r || r.storeId !== store.id) return { ok: false, error: "룸을 찾을 수 없어요." };
    await prisma.room.delete({ where: { id: roomId } });
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 룸 한 칸에 캐치걸을 넣거나(staffId) 비운다(staffId = "").
 * 같은 조에 이미 다른 룸을 맡고 있으면 그 배치를 옮긴다 — 중복 배치를 만들지 않는다.
 */
export async function assignShift(
  slug: string,
  input: { date: string; shift: "DAY" | "NIGHT"; roomId: string; staffId: string },
): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const { date, shift, roomId, staffId } = input;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !["DAY", "NIGHT"].includes(shift)) return { ok: false, error: "날짜/조를 확인해 주세요." };
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.storeId !== store.id) return { ok: false, error: "룸을 찾을 수 없어요." };

    if (!staffId) {
      await prisma.shiftAssignment.deleteMany({ where: { roomId, date, shift } });
    } else {
      const staff = await prisma.staff.findUnique({ where: { id: staffId } });
      if (!staff || staff.storeId !== store.id) return { ok: false, error: "캐치걸를 찾을 수 없어요." };
      await prisma.$transaction([
        // 이 사람이 같은 조에 맡고 있던 다른 룸을 먼저 비운다 (방 이동)
        prisma.shiftAssignment.deleteMany({ where: { staffId, date, shift } }),
        prisma.shiftAssignment.deleteMany({ where: { roomId, date, shift } }),
        prisma.shiftAssignment.create({ data: { storeId: store.id, date, shift, roomId, staffId } }),
      ]);
    }
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 하루 배치를 통째로 다른 날짜에 복사 — 주간 스케줄을 짤 때 반복 입력을 줄인다 */
export async function copyDayAssignments(slug: string, fromDate: string, toDate: string): Promise<R<{ count: number }>> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    if (fromDate === toDate) return { ok: false, error: "같은 날짜예요." };
    const src = await prisma.shiftAssignment.findMany({ where: { storeId: store.id, date: fromDate } });
    if (src.length === 0) return { ok: false, error: "복사할 배치가 없어요." };
    await prisma.$transaction([
      prisma.shiftAssignment.deleteMany({ where: { storeId: store.id, date: toDate } }),
      prisma.shiftAssignment.createMany({
        data: src.map((a) => ({ storeId: store.id, date: toDate, shift: a.shift, roomId: a.roomId, staffId: a.staffId })),
      }),
    ]);
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true, data: { count: src.length } };
  } catch (e) {
    return fail(e);
  }
}

/** 하루 배치 전체 비우기 */
export async function clearDayAssignments(slug: string, date: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    await prisma.shiftAssignment.deleteMany({ where: { storeId: store.id, date } });
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── 자리 비움(외출) ─── */
const timeOffSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(40).optional().default(""),
});
/** 관리자가 "얘 지금 나가 있음" 을 표시 — 그 시간대 예약이 닫힌다 */
export async function adminAddTimeOff(slug: string, input: z.input<typeof timeOffSchema>): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const p = timeOffSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "입력값을 확인해 주세요." };
    const d = p.data;
    const s = await prisma.staff.findUnique({ where: { id: d.staffId } });
    if (!s || s.storeId !== store.id) return { ok: false, error: "캐치걸를 찾을 수 없어요." };
    if (d.startTime === d.endTime) return { ok: false, error: "시작과 종료 시각이 같아요." };
    await prisma.staffTimeOff.create({ data: { ...d, createdBy: "ADMIN" } });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function adminDeleteTimeOff(slug: string, id: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const t = await prisma.staffTimeOff.findUnique({ where: { id }, include: { staff: true } });
    if (!t || t.staff.storeId !== store.id) return { ok: false, error: "기록을 찾을 수 없어요." };
    await prisma.staffTimeOff.delete({ where: { id } });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── 공지사항 관리 ─── */
const noticeSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "제목을 입력해 주세요").max(40),
  body: z.string().trim().min(1, "내용을 입력해 주세요").max(1000),
  isPinned: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export async function saveNotice(slug: string, input: z.input<typeof noticeSchema>): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const p = noticeSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const d = p.data;
    if (d.id) {
      const ex = await prisma.notice.findUnique({ where: { id: d.id } });
      if (!ex || ex.storeId !== store.id) return { ok: false, error: "공지를 찾을 수 없어요." };
      await prisma.notice.update({ where: { id: d.id }, data: { title: d.title, body: d.body, isPinned: d.isPinned, isActive: d.isActive } });
    } else {
      const count = await prisma.notice.count({ where: { storeId: store.id } });
      await prisma.notice.create({ data: { storeId: store.id, title: d.title, body: d.body, isPinned: d.isPinned, isActive: d.isActive, sortOrder: count } });
    }
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteNotice(slug: string, noticeId: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const n = await prisma.notice.findUnique({ where: { id: noticeId } });
    if (!n || n.storeId !== store.id) return { ok: false, error: "공지를 찾을 수 없어요." };
    await prisma.notice.delete({ where: { id: noticeId } });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── 추가 옵션 관리 ─── */
const optionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "옵션 이름을 입력해 주세요").max(20),
  price: z.coerce.number().int().min(0).max(100_000_000),
  isActive: z.boolean().default(true),
});
export async function saveStoreOption(slug: string, input: z.input<typeof optionSchema>): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const p = optionSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const d = p.data;
    if (d.id) {
      const ex = await prisma.storeOption.findUnique({ where: { id: d.id } });
      if (!ex || ex.storeId !== store.id) return { ok: false, error: "옵션을 찾을 수 없어요." };
      await prisma.storeOption.update({ where: { id: d.id }, data: { name: d.name, price: d.price, isActive: d.isActive } });
    } else {
      const count = await prisma.storeOption.count({ where: { storeId: store.id } });
      await prisma.storeOption.create({ data: { storeId: store.id, name: d.name, price: d.price, isActive: d.isActive, sortOrder: count } });
    }
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 옵션 삭제 — 이미 팔린 예약의 옵션 내역은 이름·가격을 복사해 뒀으므로 그대로 남는다 */
export async function deleteStoreOption(slug: string, optionId: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const o = await prisma.storeOption.findUnique({ where: { id: optionId } });
    if (!o || o.storeId !== store.id) return { ok: false, error: "옵션을 찾을 수 없어요." };
    await prisma.storeOption.delete({ where: { id: optionId } });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── 고객 관리 ─── */
const customerInfoSchema = z.object({
  nickname: z.string().trim().min(1).max(12),
  adminMemo: z.string().max(500).default(""),
  isBlacklisted: z.boolean().default(false),
});
/** 관리자 — 고객 기본 정보 수정 (닉네임·고정 메모·블랙리스트) */
export async function saveCustomerInfo(slug: string, customerId: string, input: z.input<typeof customerInfoSchema>): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!c || c.storeId !== store.id) return { ok: false, error: "고객을 찾을 수 없어요." };
    const p = customerInfoSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "입력값을 확인해 주세요." };
    const d = p.data;
    await prisma.customer.update({
      where: { id: customerId },
      data: { nickname: d.nickname, adminMemo: d.adminMemo, isBlacklisted: d.isBlacklisted },
    });
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) return { ok: false, error: "같은 닉네임의 고객이 이미 있어요." };
    return fail(e);
  }
}

/**
 * 기존 고객에게 연결코드를 발급한다.
 * 카톡·전화로만 오가던 손님이 앱에서 새 닉네임을 만들면 이력이 갈라지므로,
 * 이 코드를 알려주면 첫 로그인 때 기존 기록을 그대로 이어받는다.
 */
export async function issueInviteCode(slug: string, customerId: string): Promise<R<{ code: string }>> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!c || c.storeId !== store.id) return { ok: false, error: "고객을 찾을 수 없어요." };
    // 헷갈리는 글자(0/O, 1/I) 는 빼고 4자리
    const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 12; i++) {
      code = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
      const dup = await prisma.customer.findFirst({ where: { storeId: store.id, inviteCode: code } });
      if (!dup) break;
      code = "";
    }
    if (!code) return { ok: false, error: "코드 생성에 실패했어요. 다시 시도해 주세요." };
    await prisma.customer.update({ where: { id: customerId }, data: { inviteCode: code } });
    revalidatePath(`/${slug}/admin/customers/${customerId}`);
    return { ok: true, data: { code } };
  } catch (e) {
    return fail(e);
  }
}

/** 고객 PIN 초기화 — 다음 로그인 때 새 PIN 을 정하게 한다 */
export async function resetCustomerPin(slug: string, customerId: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!c || c.storeId !== store.id) return { ok: false, error: "고객을 찾을 수 없어요." };
    await prisma.customer.update({ where: { id: customerId }, data: { passwordHash: null } });
    revalidatePath(`/${slug}/admin/customers/${customerId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 관리자 — 고객 메모 한 줄 추가 (방문마다 쌓이는 시간순 기록) */
export async function addCustomerNote(slug: string, customerId: string, content: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    const admin = await requireAdmin(store.id);
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!c || c.storeId !== store.id) return { ok: false, error: "고객을 찾을 수 없어요." };
    const text = content.trim();
    if (!text) return { ok: false, error: "메모 내용을 입력해 주세요." };
    if (text.length > 500) return { ok: false, error: "메모는 500자까지 쓸 수 있어요." };
    await prisma.customerNote.create({ data: { storeId: store.id, customerId, authorName: admin.name, content: text } });
    revalidatePath(`/${slug}/admin/customers/${customerId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 관리자 — 고객 메모 삭제 */
export async function deleteCustomerNote(slug: string, noteId: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const n = await prisma.customerNote.findUnique({ where: { id: noteId } });
    if (!n || n.storeId !== store.id) return { ok: false, error: "메모를 찾을 수 없어요." };
    await prisma.customerNote.delete({ where: { id: noteId } });
    revalidatePath(`/${slug}/admin/customers/${n.customerId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── 후기/댓글 관리 ─── */
export async function adminReviewAction(slug: string, reviewId: string, action: "hide" | "show" | "dismiss" | "reply", payload?: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const rv = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!rv || rv.storeId !== store.id) return { ok: false, error: "후기를 찾을 수 없어요." };
    const data =
      action === "hide" ? { isHidden: true, isReported: false }
      : action === "show" ? { isHidden: false }
      : action === "dismiss" ? { isReported: false, reportReason: null }
      : { reply: (payload ?? "").trim() || null, repliedAt: payload?.trim() ? new Date() : null };
    await prisma.review.update({ where: { id: reviewId }, data });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function adminCommentAction(slug: string, commentId: string, action: "hide" | "show" | "reply", payload?: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    const admin = await requireAdmin(store.id);
    const c = await prisma.comment.findUnique({ where: { id: commentId }, include: { staff: true } });
    if (!c || c.storeId !== store.id) return { ok: false, error: "댓글을 찾을 수 없어요." };
    if (action === "reply") {
      const text = (payload ?? "").trim();
      if (!text) return { ok: false, error: "내용을 입력해 주세요." };
      // 관리자는 관리자 이름으로 단다 — 캐치걸 이름을 빌리지 않는다
      await prisma.comment.create({ data: { storeId: store.id, staffId: c.staffId, authorType: "ADMIN", authorName: admin.name, content: text, parentId: c.parentId ?? c.id } });
    } else {
      await prisma.comment.update({ where: { id: commentId }, data: { isHidden: action === "hide" } });
    }
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── 매장 설정 (화이트라벨) ─── */
const storeSchema = z.object({
  name: z.string().trim().min(1).max(30),
  tagline: z.string().trim().max(40).default(""),
  logoUrl: z.string().nullable().default(null),
  coverUrl: z.string().nullable().default(null),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: z.coerce.number().int().refine((v) => [30, 60].includes(v), "30 또는 60"),
  closedDays: z.array(z.number().int().min(0).max(6)).default([]),
  cancelDeadlineHours: z.coerce.number().int().min(0).max(72),
  maxAdvanceDays: z.coerce.number().int().min(1).max(90),
  noshowPolicy: z.string().trim().max(300).default(""),
});
export async function saveStoreSettings(slug: string, input: z.input<typeof storeSchema>): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const p = storeSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    await prisma.store.update({ where: { id: store.id }, data: { ...p.data, closedDays: JSON.stringify(p.data.closedDays) } });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── 리마인드 수동 트리거 (MVP) ─── */
export async function triggerReminders(slug: string): Promise<R<{ count: number }>> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const count = await sendDueReminders();
    return { ok: true, data: { count } };
  } catch (e) {
    return fail(e);
  }
}
