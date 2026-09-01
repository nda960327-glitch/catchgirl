"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clearSession, getCustomer, requireCustomer, setSession } from "@/lib/auth";
import { getStoreBySlug } from "@/lib/store";
import { cancelReservation, createReservation, SlotConflictError } from "@/lib/reservations";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; conflict?: boolean };

/* ─── 고객 로그인: 닉네임 + PIN (+ 첫 시작은 연결코드) ───
   휴대폰·실명 같은 개인정보는 받지 않는다. 매장 안에서만 통하는 닉네임과
   본인 확인용 PIN 만으로 신원을 잡는다.

   계정은 아무나 못 만든다. 초대받은 분만 쓰는 공간이라, 처음 시작할 때는
   매장이 발급한 연결코드가 반드시 있어야 한다. 한 번 만든 뒤로는
   닉네임 + PIN 으로 들어온다 (매번 코드를 받으러 갈 필요는 없다). */
const loginSchema = z.object({
  nickname: z.string().trim().min(1, "닉네임을 입력해 주세요").max(12, "닉네임은 12자 이하"),
  pin: z.string().trim().regex(/^\d{4,6}$/, "PIN은 숫자 4~6자리예요"),
  inviteCode: z.string().trim().toUpperCase().max(12).optional().default(""),
});
const pick = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, (fd.get(k) ?? "") as string]));

export async function loginCustomer(slug: string, form: FormData, next?: string): Promise<ActionResult> {
  const store = await getStoreBySlug(slug);
  const parsed = loginSchema.safeParse(pick(form, ["nickname", "pin", "inviteCode"]));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { nickname, pin, inviteCode } = parsed.data;

  const byNickname = await prisma.customer.findUnique({ where: { storeId_nickname: { storeId: store.id, nickname } } });

  // 이미 만들어 둔 계정이면 코드 없이 닉네임 + PIN 으로 들어온다
  if (!inviteCode) {
    if (!byNickname?.passwordHash) {
      return { ok: false, error: "처음이시라면 매장에서 받은 연결코드를 입력해 주세요." };
    }
    if (!(await bcrypt.compare(pin, byNickname.passwordHash))) {
      return { ok: false, error: "닉네임 또는 PIN이 맞지 않아요." };
    }
    await setSession({ role: "customer", id: byNickname.id, storeId: store.id, name: byNickname.nickname });
    redirect(next && next.startsWith(`/${slug}`) ? next : `/${slug}/me`);
  }

  // 연결코드로 시작 — 매장이 미리 만들어 둔 기록에 닉네임과 PIN 을 붙인다
  const invited = await prisma.customer.findFirst({ where: { storeId: store.id, inviteCode } });
  if (!invited) return { ok: false, error: "연결코드가 맞지 않아요. 매장에 확인해 주세요." };
  if (byNickname && byNickname.id !== invited.id) {
    return { ok: false, error: "이미 쓰고 있는 닉네임이에요. 다른 닉네임으로 해주세요." };
  }
  const claimed = await prisma.customer.update({
    where: { id: invited.id },
    data: { nickname, passwordHash: await bcrypt.hash(pin, 10), inviteCode: null },
  });
  await setSession({ role: "customer", id: claimed.id, storeId: store.id, name: claimed.nickname });
  redirect(next && next.startsWith(`/${slug}`) ? next : `/${slug}/me`);
}

/** 마이페이지 — 닉네임 수정 */
export async function updateMyProfile(slug: string, form: FormData): Promise<ActionResult> {
  const store = await getStoreBySlug(slug);
  const me = await getCustomer(store.id);
  if (!me) return { ok: false, error: "LOGIN_REQUIRED" };
  const parsed = z
    .object({ nickname: z.string().trim().min(1, "닉네임을 입력해 주세요").max(12) })
    .safeParse(pick(form, ["nickname"]));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    await prisma.customer.update({ where: { id: me.id }, data: { nickname: d.nickname } });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) return { ok: false, error: "이미 쓰고 있는 닉네임이에요." };
    throw e;
  }
  revalidatePath(`/${slug}/me`);
  return { ok: true };
}

/** 마이페이지 — PIN 변경 */
export async function changeMyPin(slug: string, currentPin: string, newPin: string): Promise<ActionResult> {
  const store = await getStoreBySlug(slug);
  const me = await getCustomer(store.id);
  if (!me) return { ok: false, error: "LOGIN_REQUIRED" };
  if (!/^\d{4,6}$/.test(newPin)) return { ok: false, error: "새 PIN은 숫자 4~6자리예요" };
  if (me.passwordHash && !(await bcrypt.compare(currentPin, me.passwordHash))) return { ok: false, error: "현재 PIN이 맞지 않아요." };
  await prisma.customer.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(newPin, 10) } });
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
  hours: z.coerce.number().int().min(1).max(8).default(1),
  optionIds: z.array(z.string()).max(20).default([]),
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

/* ─── 추천 / 비추천 ─── */
/** 같은 버튼을 다시 누르면 취소, 반대쪽을 누르면 갈아탄다. 반환값은 누른 뒤 내 표 상태. */
export async function voteStaff(slug: string, staffId: string, value: "UP" | "DOWN"): Promise<ActionResult<{ my: "UP" | "DOWN" | null }>> {
  const store = await getStoreBySlug(slug);
  const customer = await getCustomer(store.id);
  if (!customer) return { ok: false, error: "LOGIN_REQUIRED" };
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.storeId !== store.id) return { ok: false, error: "캐치걸를 찾을 수 없어요." };

  const ex = await prisma.staffVote.findUnique({ where: { customerId_staffId: { customerId: customer.id, staffId } } });
  let my: "UP" | "DOWN" | null;
  if (!ex) {
    await prisma.staffVote.create({ data: { customerId: customer.id, staffId, value } });
    my = value;
  } else if (ex.value === value) {
    await prisma.staffVote.delete({ where: { id: ex.id } });
    my = null;
  } else {
    await prisma.staffVote.update({ where: { id: ex.id }, data: { value } });
    my = value;
  }
  revalidatePath(`/${slug}/bartenders/${staffId}`);
  revalidatePath(`/${slug}/bartenders`);
  return { ok: true, data: { my } };
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
