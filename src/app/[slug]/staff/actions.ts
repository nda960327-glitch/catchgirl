"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { clearSession, requireStaff, setSession } from "@/lib/auth";
import { getStoreBySlug } from "@/lib/store";
import { cleanCheck } from "@/lib/profanity";

export type R = { ok: true } | { ok: false; error: string };

export async function loginStaff(slug: string, form: FormData, next?: string): Promise<R> {
  const store = await getStoreBySlug(slug);
  const loginId = String(form.get("loginId") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const staff = await prisma.staff.findUnique({ where: { loginId } });
  if (!staff || staff.storeId !== store.id || !staff.isActive || !staff.passwordHash || !(await bcrypt.compare(password, staff.passwordHash))) {
    return { ok: false, error: "아이디 또는 비밀번호가 맞지 않아요." };
  }
  await setSession({ role: "staff", id: staff.id, storeId: store.id, name: staff.nickname });
  redirect(next && next.startsWith(`/${slug}/staff`) ? next : `/${slug}/staff`);
}
export async function logoutStaff(slug: string) {
  await clearSession("staff");
  redirect(`/${slug}/staff/login`);
}

/* ─── 자리 비움(외출) — 본인이 직접 등록·삭제 ─── */
export async function addMyTimeOff(
  slug: string,
  input: { date: string; startTime: string; endTime: string; reason?: string },
): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    const me = await requireStaff(store.id);
    const { date, startTime, endTime } = input;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return { ok: false, error: "날짜와 시간을 확인해 주세요." };
    }
    if (startTime === endTime) return { ok: false, error: "시작과 종료 시각이 같아요." };
    await prisma.staffTimeOff.create({
      data: { staffId: me.id, date, startTime, endTime, reason: (input.reason ?? "").trim().slice(0, 40), createdBy: "STAFF" },
    });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "권한이 없어요." };
  }
}

export async function deleteMyTimeOff(slug: string, id: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    const me = await requireStaff(store.id);
    const t = await prisma.staffTimeOff.findUnique({ where: { id } });
    if (!t || t.staffId !== me.id) return { ok: false, error: "본인 기록만 지울 수 있어요." };
    if (t.createdBy === "ADMIN") return { ok: false, error: "매장에서 등록한 건 매장에 문의해 주세요." };
    await prisma.staffTimeOff.delete({ where: { id } });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "권한이 없어요." };
  }
}

/**
 * 내가 일할 수 있는 요일·시간 알리기.
 * 이건 "가능하다"는 표시일 뿐 실제 근무는 아니다 — 매장이 이걸 보고 룸에 배치하고,
 * 손님 예약은 배치된 날의 배치된 조에만 잡힌다.
 */
export async function setMyAvailability(slug: string, slots: { weekday: number; shift: "DAY" | "NIGHT" }[]): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    const me = await requireStaff(store.id);
    // 같은 (요일, 조) 가 중복으로 들어오지 않게 한 번 걸러 낸다
    const seen = new Set<string>();
    const clean = slots
      .filter((s) => Number.isInteger(s.weekday) && s.weekday >= 0 && s.weekday <= 6 && (s.shift === "DAY" || s.shift === "NIGHT"))
      .filter((s) => {
        const k = `${s.weekday}|${s.shift}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 14);
    // 시간대는 조에서 정해지므로 매장 설정 값을 그대로 복사해 둔다
    const hours = (shift: "DAY" | "NIGHT") =>
      shift === "DAY" ? { startTime: store.openTime, endTime: store.shiftSplitTime } : { startTime: store.shiftSplitTime, endTime: store.closeTime };
    await prisma.$transaction([
      prisma.staffSchedule.deleteMany({ where: { staffId: me.id } }),
      prisma.staffSchedule.createMany({
        data: clean.map((s) => ({ staffId: me.id, weekday: s.weekday, shift: s.shift, ...hours(s.shift) })),
      }),
    ]);
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "권한이 없어요." };
  }
}

/** 내가 제공하는 옵션 켜고 끄기 */
export async function setMyOptions(slug: string, optionIds: string[]): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    const me = await requireStaff(store.id);
    const valid = await prisma.storeOption.findMany({ where: { id: { in: optionIds }, storeId: store.id }, select: { id: true } });
    await prisma.staff.update({ where: { id: me.id }, data: { options: { set: valid.map((o) => ({ id: o.id })) } } });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "권한이 없어요." };
  }
}

/** 후기 답글 (본인 후기만) */
export async function staffReplyReview(slug: string, reviewId: string, text: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    const me = await requireStaff(store.id);
    const rv = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!rv || rv.staffId !== me.id) return { ok: false, error: "본인 후기에만 답글을 달 수 있어요." };
    const t = text.trim();
    { const dirty = cleanCheck(t); if (!dirty.ok) return dirty; }
    await prisma.review.update({ where: { id: reviewId }, data: { reply: t || null, repliedAt: t ? new Date() : null } });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "권한이 없어요." };
  }
}

/** 댓글 답글 (본인 게시판만, 1뎁스) */
export async function staffReplyComment(slug: string, commentId: string, text: string): Promise<R> {
  try {
    const store = await getStoreBySlug(slug);
    const me = await requireStaff(store.id);
    const c = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!c || c.staffId !== me.id) return { ok: false, error: "본인 게시판 댓글에만 답글을 달 수 있어요." };
    const t = text.trim();
    if (!t) return { ok: false, error: "내용을 입력해 주세요." };
    { const dirty = cleanCheck(t); if (!dirty.ok) return dirty; }
    await prisma.comment.create({ data: { storeId: store.id, staffId: me.id, authorType: "STAFF", authorName: me.nickname, content: t, parentId: c.parentId ?? c.id } });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "권한이 없어요." };
  }
}
