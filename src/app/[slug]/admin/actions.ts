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
import { ensureInviteCode, freshInviteCode } from "@/lib/invite";

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
      // 등록되는 순간부터 연결코드를 갖고 있어야 매장이 바로 알려줄 수 있다
      await ensureInviteCode(store.id, customerId);
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
  input: { date: string; shift: "DAY" | "NIGHT"; roomId: string; staffId: string; startTime?: string; endTime?: string },
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
      revalidatePath(`/${slug}/admin`, "layout");
      return { ok: true };
    }

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.storeId !== store.id) return { ok: false, error: "캐치걸를 찾을 수 없어요." };

    // 시각을 안 주면 그 조의 기본 시간대로 채운다
    const preset = shift === "DAY" ? { startTime: store.openTime, endTime: store.shiftSplitTime } : { startTime: store.shiftSplitTime, endTime: store.closeTime };
    const startTime = /^\d{2}:\d{2}$/.test(input.startTime ?? "") ? input.startTime! : preset.startTime;
    const endTime = /^\d{2}:\d{2}$/.test(input.endTime ?? "") ? input.endTime! : preset.endTime;
    if (startTime === endTime) return { ok: false, error: "시작과 종료 시각이 같아요." };

    // 같은 사람이 같은 날 다른 조에도 들어갈 수 있으니, 겹치는지는 시각으로 본다
    const openMin = toMin(store.openTime);
    const norm = (m: number) => (m < openMin ? m + 1440 : m);
    const span = (s: string, e: string) => {
      const a = norm(toMin(s));
      const b0 = norm(toMin(e));
      return { a, b: b0 <= a ? b0 + 1440 : b0 };
    };
    const mine = span(startTime, endTime);
    const sameDay = await prisma.shiftAssignment.findMany({ where: { date, storeId: store.id, OR: [{ staffId }, { roomId }] } });
    const clash = sameDay.find((o) => {
      if (o.shift === shift && (o.staffId === staffId || o.roomId === roomId)) return false; // 아래에서 교체된다
      const other = span(o.startTime, o.endTime);
      return mine.a < other.b && mine.b > other.a;
    });
    if (clash) {
      return { ok: false, error: clash.staffId === staffId ? "이 캐치걸의 다른 배치와 시간이 겹쳐요." : "이 룸의 다른 배치와 시간이 겹쳐요." };
    }

    await prisma.$transaction([
      // 이 사람이 같은 조에 맡고 있던 다른 룸을 먼저 비운다 (방 이동)
      prisma.shiftAssignment.deleteMany({ where: { staffId, date, shift } }),
      prisma.shiftAssignment.deleteMany({ where: { roomId, date, shift } }),
      prisma.shiftAssignment.create({ data: { storeId: store.id, date, shift, roomId, staffId, startTime, endTime } }),
    ]);
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 캐치걸의 근무 가능 요일·조를 관리자가 직접 켜고 끈다.
 * 원래는 본인이 앱에서 알리는 값이지만, 전화로 말하고 마는 경우가 많아
 * 매장에서도 대신 적어 둘 수 있어야 한다.
 */
export async function setStaffAvailability(
  slug: string,
  staffId: string,
  weekday: number,
  shift: "DAY" | "NIGHT",
  on: boolean,
): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: "요일을 확인해 주세요." };
    if (shift !== "DAY" && shift !== "NIGHT") return { ok: false, error: "조를 확인해 주세요." };
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.storeId !== store.id) return { ok: false, error: "캐치걸를 찾을 수 없어요." };

    if (!on) {
      await prisma.staffSchedule.deleteMany({ where: { staffId, weekday, shift } });
    } else {
      // 시간대는 조에서 정해지므로 매장 설정 값을 그대로 복사해 둔다
      const hours =
        shift === "DAY"
          ? { startTime: store.openTime, endTime: store.shiftSplitTime }
          : { startTime: store.shiftSplitTime, endTime: store.closeTime };
      await prisma.$transaction([
        prisma.staffSchedule.deleteMany({ where: { staffId, weekday, shift } }),
        prisma.staffSchedule.create({ data: { staffId, weekday, shift, ...hours } }),
      ]);
    }
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
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
        data: src.map((a) => ({ storeId: store.id, date: toDate, shift: a.shift, roomId: a.roomId, staffId: a.staffId, startTime: a.startTime, endTime: a.endTime })),
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
  adminContact: z.string().trim().max(120).default(""),
  adminMemo: z.string().max(500).default(""),
  isBlacklisted: z.boolean().default(false),
});
/** 관리자 — 고객 기본 정보 수정 (닉네임·연락처·고정 메모·블랙리스트) */
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
      data: { nickname: d.nickname, adminContact: d.adminContact, adminMemo: d.adminMemo, isBlacklisted: d.isBlacklisted },
    });
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) return { ok: false, error: "같은 닉네임의 고객이 이미 있어요." };
    return fail(e);
  }
}

/**
 * 연결코드를 새 코드로 갈아 끼운다.
 * 고객은 등록될 때부터 코드를 하나 갖고 있으므로 평소엔 쓸 일이 없고,
 * 코드가 새어 나갔을 때만 다시 뽑는다.
 */
export async function issueInviteCode(slug: string, customerId: string): Promise<R<{ code: string }>> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!c || c.storeId !== store.id) return { ok: false, error: "고객을 찾을 수 없어요." };
    const code = await freshInviteCode(store.id);
    if (!code) return { ok: false, error: "코드 생성에 실패했어요. 다시 시도해 주세요." };
    await prisma.customer.update({ where: { id: customerId }, data: { inviteCode: code } });
    revalidatePath(`/${slug}/admin/customers/${customerId}`);
    return { ok: true, data: { code } };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 아직 기록이 없는 새 손님을 초대한다.
 * 계정은 코드 없이 만들 수 없으므로, 처음 오시는 분께도 매장이 코드를 먼저 발급해야 한다.
 * 손님이 코드를 넣으며 정한 닉네임이 이 빈 기록에 붙는다.
 */
export async function inviteNewCustomer(slug: string, memo?: string): Promise<R<{ code: string }>> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const code = await freshInviteCode(store.id);
    if (!code) return { ok: false, error: "코드 생성에 실패했어요. 다시 시도해 주세요." };
    await prisma.customer.create({
      data: {
        storeId: store.id,
        // 손님이 첫 로그인 때 진짜 닉네임으로 바꾼다
        nickname: `신규-${code}`,
        inviteCode: code,
        adminMemo: (memo ?? "").trim().slice(0, 500),
      },
    });
    revalidatePath(`/${slug}/admin/customers`);
    return { ok: true, data: { code } };
  } catch (e) {
    return fail(e);
  }
}

/**
 * PIN 을 잊은 손님을 위한 재설정.
 *
 * PIN 만 지우면 손님은 다시 들어올 방법이 없다 (계정 생성은 코드로만 열려 있으므로).
 * 그래서 지우는 동시에 새 연결코드를 발급해, 손님이 그 코드로 새 PIN 을 정하게 한다.
 */
export async function resetCustomerPin(slug: string, customerId: string): Promise<R<{ code: string }>> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!c || c.storeId !== store.id) return { ok: false, error: "고객을 찾을 수 없어요." };
    // PIN 을 비우면 그 계정의 연결코드가 다시 살아난다 (코드는 계정마다 늘 하나씩 있다)
    await prisma.customer.update({ where: { id: customerId }, data: { passwordHash: null } });
    const code = await ensureInviteCode(store.id, customerId);
    if (!code) return { ok: false, error: "코드 발급에 실패했어요. 다시 시도해 주세요." };
    revalidatePath(`/${slug}/admin/customers/${customerId}`);
    return { ok: true, data: { code } };
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

/** 요금제 변경. 결제 연동이 붙기 전까지는 화면에서 바로 바뀐다. */
export async function setStorePlan(slug: string, plan: "PRO" | "MAX"): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    await requireAdmin(store.id);
    if (plan !== "PRO" && plan !== "MAX") return { ok: false, error: "요금제를 확인해 주세요." };
    if (plan === store.plan) return { ok: true };
    // 올릴 땐 그날부터 새 요금제가 시작된다
    await prisma.store.update({ where: { id: store.id }, data: { plan, planStartedAt: new Date() } });
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── 매장 설정 (화이트라벨) ─── */
const storeSchema = z.object({
  name: z.string().trim().min(1).max(30),
  tagline: z.string().trim().max(40).default(""),
  heroTitle: z.string().trim().min(1, "홈 문구를 입력해 주세요").max(60),
  logoUrl: z.string().nullable().default(null),
  coverUrl: z.string().nullable().default(null),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  shiftSplitTime: z.string().regex(/^\d{2}:\d{2}$/),
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
    // 새벽 마감을 다음 날로 펴서 본다. 교대 시각이 영업시간 밖이면 한쪽 조가 통째로 사라진다.
    const open = toMin(p.data.openTime);
    const norm = (t: string) => { const m = toMin(t); return m <= open ? m + 24 * 60 : m; };
    if (norm(p.data.shiftSplitTime) >= norm(p.data.closeTime)) {
      return { ok: false, error: "교대 시각은 오픈과 마감 사이여야 해요" };
    }
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
