"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCustomer, getStaffUser, requireAdmin } from "@/lib/auth";
import { getStoreBySlug } from "@/lib/store";
import { fileReport } from "@/lib/reports";
import { REPORT_CATEGORY_LABEL, isReportCategory, isReportTarget } from "@/lib/report-types";
import { cleanCheck } from "@/lib/profanity";

type R = { ok: true } | { ok: false; error: string };

export type ReportInput = { targetType: string; targetId: string | null; targetName: string; category: string; detail: string };

/**
 * 손님이 누르는 신고 — 직원 프로필, 댓글, 후기, 그리고 매장 자체.
 * 후기는 예전처럼 '신고됨' 표시도 같이 켜서 후기 관리 화면에서도 보이게 한다.
 */
export async function reportFromCustomer(slug: string, input: ReportInput): Promise<R> {
  const store = await getStoreBySlug(slug);
  const me = await getCustomer(store.id);
  if (!me) return { ok: false, error: "LOGIN_REQUIRED" };
  if (!isReportTarget(input.targetType)) return { ok: false, error: "대상이 올바르지 않아요." };
  if (!isReportCategory(input.category)) return { ok: false, error: "사유를 골라 주세요." };
  if (input.targetType === "CUSTOMER") return { ok: false, error: "손님은 다른 손님을 신고할 수 없어요." };

  const r = await fileReport({
    storeId: store.id,
    reporter: { type: "CUSTOMER", id: me.id, name: me.nickname },
    target: { type: input.targetType, id: input.targetId, name: input.targetName },
    category: input.category,
    detail: input.detail,
  });
  if (!r.ok) return r;
  if (input.targetType === "REVIEW" && input.targetId) {
    await prisma.review.updateMany({ where: { id: input.targetId, storeId: store.id }, data: { isReported: true, reportReason: REPORT_CATEGORY_LABEL[input.category] } });
  }
  revalidatePath(`/${slug}/admin/reports`);
  return { ok: true };
}

/** 직원이 누르는 신고 — 손님(예약 카드), 후기, 댓글 */
export async function reportFromStaff(slug: string, input: ReportInput): Promise<R> {
  const store = await getStoreBySlug(slug);
  const me = await getStaffUser(store.id);
  if (!me) return { ok: false, error: "LOGIN_REQUIRED" };
  if (!isReportTarget(input.targetType)) return { ok: false, error: "대상이 올바르지 않아요." };
  if (!isReportCategory(input.category)) return { ok: false, error: "사유를 골라 주세요." };
  if (input.targetType === "STAFF") return { ok: false, error: "직원끼리는 앱 안에서 신고할 수 없어요. 매장에 직접 말씀해 주세요." };

  const r = await fileReport({
    storeId: store.id,
    reporter: { type: "STAFF", id: me.id, name: me.nickname },
    target: { type: input.targetType, id: input.targetId, name: input.targetName },
    category: input.category,
    detail: input.detail,
  });
  if (!r.ok) return r;
  if (input.targetType === "REVIEW" && input.targetId) {
    await prisma.review.updateMany({ where: { id: input.targetId, storeId: store.id }, data: { isReported: true, reportReason: REPORT_CATEGORY_LABEL[input.category] } });
  }
  revalidatePath(`/${slug}/admin/reports`);
  return { ok: true };
}

/* ─── 차단 ───
 * 대상은 손님뿐이다. 글(후기·댓글)에서 누르면 서버가 그 글의 작성자를 찾아 차단한다 —
 * 화면에 손님 id 를 내려보내지 않아도 된다. */
export type BlockTarget = { kind: "REVIEW" | "COMMENT" | "CUSTOMER"; id: string };

async function authorOf(storeId: string, t: BlockTarget): Promise<{ id: string; name: string; staffId: string | null } | null> {
  if (t.kind === "REVIEW") {
    const r = await prisma.review.findFirst({ where: { id: t.id, storeId }, select: { staffId: true, customer: { select: { id: true, nickname: true } } } });
    return r ? { id: r.customer.id, name: r.customer.nickname, staffId: r.staffId } : null;
  }
  if (t.kind === "COMMENT") {
    const c = await prisma.comment.findFirst({ where: { id: t.id, storeId, authorType: "CUSTOMER" }, select: { staffId: true, customer: { select: { id: true, nickname: true } } } });
    return c?.customer ? { id: c.customer.id, name: c.customer.nickname, staffId: c.staffId } : null;
  }
  const cu = await prisma.customer.findFirst({ where: { id: t.id, storeId, deletedAt: null }, select: { id: true, nickname: true } });
  return cu ? { id: cu.id, name: cu.nickname, staffId: null } : null;
}

async function saveBlock(storeId: string, blockerType: "CUSTOMER" | "STAFF", blockerId: string, blocked: { id: string; name: string }) {
  await prisma.block.upsert({
    where: { blockerType_blockerId_blockedType_blockedId: { blockerType, blockerId, blockedType: "CUSTOMER", blockedId: blocked.id } },
    create: { storeId, blockerType, blockerId, blockedType: "CUSTOMER", blockedId: blocked.id, blockedName: blocked.name },
    update: { blockedName: blocked.name },
  });
}

/** 손님이 다른 손님을 차단 — 그 손님의 후기·댓글이 내 화면에서 사라진다 */
export async function blockFromCustomer(slug: string, target: BlockTarget): Promise<R> {
  const store = await getStoreBySlug(slug);
  const me = await getCustomer(store.id);
  if (!me) return { ok: false, error: "LOGIN_REQUIRED" };
  if (target.kind === "CUSTOMER") return { ok: false, error: "후기나 댓글에서 차단해 주세요." };
  const a = await authorOf(store.id, target);
  if (!a) return { ok: false, error: "직원·매장이 쓴 글은 차단 대신 신고해 주세요." };
  if (a.id === me.id) return { ok: false, error: "내 글은 차단할 수 없어요." };
  await saveBlock(store.id, "CUSTOMER", me.id, a);
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

/** 직원이 손님을 차단 — 그 손님은 이 직원을 예약하거나 이 직원 프로필에 댓글을 달 수 없다 */
export async function blockFromStaff(slug: string, target: BlockTarget): Promise<R> {
  const store = await getStoreBySlug(slug);
  const me = await getStaffUser(store.id);
  if (!me) return { ok: false, error: "LOGIN_REQUIRED" };
  const a = await authorOf(store.id, target);
  if (!a) return { ok: false, error: "손님을 찾을 수 없어요." };
  if (a.staffId && a.staffId !== me.id) return { ok: false, error: "내 프로필에 달린 글만 차단할 수 있어요." };
  await saveBlock(store.id, "STAFF", me.id, a);
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

/** 차단 풀기 — 내가 한 차단만 풀 수 있다 */
export async function unblock(slug: string, role: "customer" | "staff", blockId: string): Promise<R> {
  const store = await getStoreBySlug(slug);
  const me = role === "customer" ? await getCustomer(store.id) : await getStaffUser(store.id);
  if (!me) return { ok: false, error: "LOGIN_REQUIRED" };
  const r = await prisma.block.deleteMany({ where: { id: blockId, storeId: store.id, blockerType: role === "customer" ? "CUSTOMER" : "STAFF", blockerId: me.id } });
  if (!r.count) return { ok: false, error: "차단 기록을 찾을 수 없어요." };
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

/** 매장 관리자가 신고를 닫는다 — 조치 완료 또는 문제 없음. 메모는 콘솔에서도 보인다. */
export async function resolveReportByStore(slug: string, id: string, status: "RESOLVED" | "DISMISSED" | "OPEN", note: string): Promise<R> {
  const store = await getStoreBySlug(slug);
  try {
    await requireAdmin(store.id);
  } catch {
    return { ok: false, error: "권한이 없어요." };
  }
  const clean = cleanCheck(note);
  if (!clean.ok) return clean;
  const row = await prisma.report.findFirst({ where: { id, storeId: store.id } });
  if (!row) return { ok: false, error: "신고를 찾을 수 없어요." };
  // 운영사가 이미 닫은 신고는 매장이 다시 열지 못한다
  if (row.handledBy === "PLATFORM" && row.status !== "OPEN") return { ok: false, error: "운영사가 처리한 신고예요. 바꾸려면 운영사에 연락해 주세요." };
  await prisma.report.update({
    where: { id },
    data: { status, adminNote: note.trim().slice(0, 300), handledBy: status === "OPEN" ? "" : "STORE", resolvedAt: status === "OPEN" ? null : new Date() },
  });
  revalidatePath(`/${slug}/admin/reports`);
  revalidatePath("/platform/reports");
  return { ok: true };
}
