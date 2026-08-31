"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clearSession, getCustomer, requireCustomer, setSession } from "@/lib/auth";
import { getStoreBySlug } from "@/lib/store";
import { cancelReservation, createReservation, SlotConflictError } from "@/lib/reservations";
import { normalizePhone } from "@/lib/utils";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; conflict?: boolean };

/* ─── 고객 로그인: 휴대폰 + 닉네임 (없으면 생성) ─── */
const profileSchema = z.object({
  name: z.string().trim().max(20).optional().default(""),
  email: z.string().trim().max(60).optional().default(""),
  birthday: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "생년월일 형식을 확인해 주세요").optional().default(""),
  gender: z.enum(["F", "M", "N", ""]).optional().default(""),
  instagram: z.string().trim().max(40).optional().default(""),
  referral: z.string().trim().max(20).optional().default(""),
});
const loginSchema = profileSchema.extend({
  nickname: z.string().trim().min(1, "닉네임을 입력해 주세요").max(12, "닉네임은 12자 이하"),
  phone: z.string().trim().regex(/^\d{2,3}-?\d{3,4}-?\d{4}$/, "휴대폰 번호 형식을 확인해 주세요"),
});
const pick = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, (fd.get(k) ?? "") as string]));
/** 선택 입력은 값이 있을 때만 덮어쓴다 (비워서 지우는 건 마이페이지에서) */
const optionalData = (d: z.infer<typeof profileSchema>) => ({
  ...(d.name ? { name: d.name } : {}), ...(d.email ? { email: d.email } : {}), ...(d.birthday ? { birthday: d.birthday } : {}),
  ...(d.gender ? { gender: d.gender } : {}), ...(d.instagram ? { instagram: d.instagram.replace(/^@/, "") } : {}), ...(d.referral ? { referral: d.referral } : {}),
});
export async function loginCustomer(slug: string, form: FormData, next?: string): Promise<ActionResult> {
  const store = await getStoreBySlug(slug);
  const parsed = loginSchema.safeParse(pick(form, ["nickname", "phone", "name", "email", "birthday", "gender", "instagram", "referral"]));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const phone = normalizePhone(parsed.data.phone);
  const extra = optionalData(parsed.data);
  let customer = await prisma.customer.findUnique({ where: { storeId_phone: { storeId: store.id, phone } } });
  if (!customer) {
    customer = await prisma.customer.create({ data: { storeId: store.id, nickname: parsed.data.nickname, phone, ...extra } });
  } else {
    // 같은 번호 재방문: 닉네임/추가 정보 갱신
    customer = await prisma.customer.update({ where: { id: customer.id }, data: { nickname: parsed.data.nickname, ...extra } });
  }
  await setSession({ role: "customer", id: customer.id, storeId: store.id, name: customer.nickname });
  redirect(next && next.startsWith(`/${slug}`) ? next : `/${slug}/me`);
}

/** 마이페이지 — 내 정보 수정 (빈 값은 지움) */
export async function updateMyProfile(slug: string, form: FormData): Promise<ActionResult> {
  const store = await getStoreBySlug(slug);
  const me = await getCustomer(store.id);
  if (!me) return { ok: false, error: "LOGIN_REQUIRED" };
  const parsed = profileSchema.extend({ nickname: z.string().trim().min(1, "닉네임을 입력해 주세요").max(12) }).safeParse(pick(form, ["nickname", "name", "email", "birthday", "gender", "instagram", "referral"]));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  await prisma.customer.update({
    where: { id: me.id },
    data: { nickname: d.nickname, name: d.name || null, email: d.email || null, birthday: d.birthday || null, gender: d.gender || null, instagram: d.instagram.replace(/^@/, "") || null, referral: d.referral || null },
  });
  revalidatePath(`/${slug}/me`);
  return { ok: true };
}

export async function logoutCustomer(slug: string) {
  await clearSession("customer");
  redirect(`/${slug}`);
}

/* ─── 예약 생성 ─── */
const bookSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(8),
  requestNote: z.string().trim().max(200).optional().default(""),
  purposeTag: z.string().trim().max(20).optional().default(""),
});
export async function bookReservation(slug: string, input: z.input<typeof bookSchema>): Promise<ActionResult<{ id: string }>> {
  const store = await getStoreBySlug(slug);
  const customer = await getCustomer(store.id);
  if (!customer) return { ok: false, error: "LOGIN_REQUIRED" };
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "입력값을 확인해 주세요." };
  try {
    const r = await createReservation({ ...parsed.data, storeId: store.id, customerId: customer.id, createdBy: "CUSTOMER" });
    revalidatePath(`/${slug}`);
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    if (e instanceof SlotConflictError) return { ok: false, error: e.message, conflict: true };
    return { ok: false, error: e instanceof Error ? e.message : "예약에 실패했어요." };
  }
}

export async function cancelMyReservation(slug: string, reservationId: string): Promise<ActionResult> {
  const store = await getStoreBySlug(slug);
  const customer = await getCustomer(store.id);
  if (!customer) return { ok: false, error: "LOGIN_REQUIRED" };
  const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!r || r.customerId !== customer.id) return { ok: false, error: "예약을 찾을 수 없어요." };
  try {
    await cancelReservation(r.id, "CUSTOMER");
    revalidatePath(`/${slug}/me`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "취소에 실패했어요." };
  }
}

/* ─── 찜 ─── */
export async function toggleFavorite(slug: string, staffId: string): Promise<ActionResult<{ on: boolean }>> {
  const store = await getStoreBySlug(slug);
  const customer = await getCustomer(store.id);
  if (!customer) return { ok: false, error: "LOGIN_REQUIRED" };
  const ex = await prisma.favorite.findUnique({ where: { customerId_staffId: { customerId: customer.id, staffId } } });
  if (ex) await prisma.favorite.delete({ where: { id: ex.id } });
  else await prisma.favorite.create({ data: { customerId: customer.id, staffId } });
  revalidatePath(`/${slug}/bartenders/${staffId}`);
  return { ok: true, data: { on: !ex } };
}

/* ─── 댓글 ─── */
export async function addComment(slug: string, staffId: string, content: string, parentId?: string): Promise<ActionResult> {
  const store = await getStoreBySlug(slug);
  const customer = await getCustomer(store.id);
  if (!customer) return { ok: false, error: "LOGIN_REQUIRED" };
  const text = content.trim();
  if (!text || text.length > 300) return { ok: false, error: "댓글은 1~300자" };
  await prisma.comment.create({
    data: { storeId: store.id, staffId, customerId: customer.id, authorType: "CUSTOMER", authorName: customer.nickname, content: text, parentId: parentId ?? null },
  });
  revalidatePath(`/${slug}/bartenders/${staffId}`);
  return { ok: true };
}

/* ─── 후기 (완료된 예약만) ─── */
const reviewSchema = z.object({
  reservationId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  content: z.string().trim().min(5, "후기를 5자 이상 적어주세요").max(500),
  photos: z.array(z.string()).max(5).default([]),
});
export async function submitReview(slug: string, input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const store = await getStoreBySlug(slug);
  const customer = await requireCustomer(store.id).catch(() => null);
  if (!customer) return { ok: false, error: "LOGIN_REQUIRED" };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const r = await prisma.reservation.findUnique({ where: { id: parsed.data.reservationId }, include: { review: true } });
  if (!r || r.customerId !== customer.id) return { ok: false, error: "예약을 찾을 수 없어요." };
  if (r.status !== "COMPLETED") return { ok: false, error: "방문 완료된 예약만 후기를 쓸 수 있어요." };
  if (r.review) return { ok: false, error: "이미 후기를 남긴 예약이에요." };
  await prisma.review.create({
    data: {
      storeId: store.id,
      reservationId: r.id,
      staffId: r.staffId,
      customerId: customer.id,
      rating: parsed.data.rating,
      content: parsed.data.content,
      photos: JSON.stringify(parsed.data.photos),
    },
  });
  revalidatePath(`/${slug}/me`);
  revalidatePath(`/${slug}/bartenders/${r.staffId}`);
  return { ok: true };
}

export async function reportReview(slug: string, reviewId: string, reason: string): Promise<ActionResult> {
  const store = await getStoreBySlug(slug);
  const customer = await getCustomer(store.id);
  if (!customer) return { ok: false, error: "LOGIN_REQUIRED" };
  await prisma.review.update({ where: { id: reviewId }, data: { isReported: true, reportReason: reason.slice(0, 100) || "신고" } });
  return { ok: true };
}
