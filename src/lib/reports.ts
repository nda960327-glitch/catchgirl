import "server-only";
import { prisma } from "@/lib/db";
import { logPlatform } from "@/lib/platform-data";
import { cleanCheck } from "@/lib/profanity";
import { REPORT_CATEGORY_LABEL, REPORT_DAILY_LIMIT, REPORT_DETAIL_MAX, REPORT_TARGET_LABEL, type ReportCategory, type ReportTargetType, type ReporterType } from "@/lib/report-types";

/**
 * 신고 접수 — 손님과 직원이 같은 길로 들어온다.
 *
 * 신고는 매장 관리자 화면에 뜨고, 운영사 콘솔 기록에도 같이 남는다.
 * 약관 4항(위반 시 즉시 정지)은 매장이 스스로 지키기 어려운 조항이라
 * 파는 쪽이 신고를 직접 봐야 한다. 그래서 매장을 건너뛰고 올라간다.
 */
export type FileReportInput = {
  storeId: string;
  reporter: { type: ReporterType; id: string; name: string };
  target: { type: ReportTargetType; id: string | null; name: string };
  category: ReportCategory;
  detail: string;
};

export type FileReportResult = { ok: true; id: string } | { ok: false; error: string };

export async function fileReport(input: FileReportInput): Promise<FileReportResult> {
  const detail = input.detail.trim().slice(0, REPORT_DETAIL_MAX);
  // 신고 글에도 욕설·성적 표현은 못 쓴다 — 신고를 빙자한 욕도 같은 위반이다
  const dirty = cleanCheck(detail);
  if (!dirty.ok) return dirty;

  const since = new Date(Date.now() - 86_400_000);
  const today = await prisma.report.count({ where: { storeId: input.storeId, reporterType: input.reporter.type, reporterId: input.reporter.id, createdAt: { gte: since } } });
  if (today >= REPORT_DAILY_LIMIT) return { ok: false, error: `신고는 하루 ${REPORT_DAILY_LIMIT}건까지 할 수 있어요. 급한 일이면 매장이나 운영사에 직접 알려 주세요.` };

  // 같은 대상을 같은 사람이 아직 확인 중일 때 또 누르면 하나로 본다
  const dup = await prisma.report.findFirst({
    where: { storeId: input.storeId, reporterType: input.reporter.type, reporterId: input.reporter.id, targetType: input.target.type, targetId: input.target.id, status: "OPEN" },
    select: { id: true },
  });
  if (dup) return { ok: true, id: dup.id };

  const row = await prisma.report.create({
    data: {
      storeId: input.storeId,
      reporterType: input.reporter.type,
      reporterId: input.reporter.id,
      reporterName: input.reporter.name.slice(0, 40),
      targetType: input.target.type,
      targetId: input.target.id,
      targetName: input.target.name.slice(0, 60),
      category: input.category,
      detail,
    },
  });
  await logPlatform(
    "REPORTED",
    `${REPORT_TARGET_LABEL[input.target.type]} ${input.target.name || ""} · ${REPORT_CATEGORY_LABEL[input.category]}${detail ? ` · ${detail.slice(0, 80)}` : ""}`,
    input.storeId,
  );
  return { ok: true, id: row.id };
}

/** 매장 관리자 화면·콘솔에 뿌리기 좋은 모양으로 */
export type ReportRow = {
  id: string;
  reporterType: ReporterType;
  reporterName: string;
  targetType: ReportTargetType;
  targetId: string | null;
  targetName: string;
  category: ReportCategory;
  detail: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  handledBy: string;
  adminNote: string;
  resolvedAt: string | null;
  createdAt: string;
};

export function toReportRow(r: {
  id: string; reporterType: string; reporterName: string; targetType: string; targetId: string | null; targetName: string;
  category: string; detail: string; status: string; handledBy: string; adminNote: string; resolvedAt: Date | null; createdAt: Date;
}): ReportRow {
  return {
    id: r.id,
    reporterType: r.reporterType as ReporterType,
    reporterName: r.reporterName,
    targetType: r.targetType as ReportTargetType,
    targetId: r.targetId,
    targetName: r.targetName,
    category: r.category as ReportCategory,
    detail: r.detail,
    status: r.status as ReportRow["status"],
    handledBy: r.handledBy,
    adminNote: r.adminNote,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function openReportCount(storeId: string) {
  return prisma.report.count({ where: { storeId, status: "OPEN" } });
}
