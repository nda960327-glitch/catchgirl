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
      isActive: d.isActive, capacityPerSlot: d.capacityPerSlot, hourlyPrice: d.hourlyPrice, loginId: d.loginId || null,
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
    };
    let id = d.id;
    if (id) {
      const ex = await prisma.staff.findUnique({ where: { id } });
      if (!ex || ex.storeId !== store.id) return { ok: false, error: "캐치걸를 찾을 수 없어요." };
      await prisma.staff.update({ where: { id }, data: base });
    } else {
      const count = await prisma.staff.count({ where: { storeId: store.id } });
      const created = await prisma.staff.create({ data: { ...base, storeId: store.id, sortOrder: count } });
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
  referral: z.string().trim().max(20).default(""),
  adminMemo: z.string().max(500).default(""),
  isBlacklisted: z.boolean().default(false),
});
/** 관리자 — 고객 기본 정보 수정 (닉네임·방문경로·고정 메모·블랙리스트) */
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
      data: { nickname: d.nickname, referral: d.referral || null, adminMemo: d.adminMemo, isBlacklisted: d.isBlacklisted },
    });
    revalidatePath(`/${slug}/admin`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) return { ok: false, error: "같은 닉네임의 고객이 이미 있어요." };
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
      await prisma.comment.create({ data: { storeId: store.id, staffId: c.staffId, authorType: "ADMIN", authorName: `${c.staff.nickname} (매장)`, content: text, parentId: c.parentId ?? c.id } });
      void admin;
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
