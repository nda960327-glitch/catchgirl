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
