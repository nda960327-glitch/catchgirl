/**
 * 신고 — 화면(클라이언트)과 서버가 같이 쓰는 이름표. server-only 를 넣지 않는다.
 *
 * 신고는 누구나 누를 수 있어야 하고, 누른 뒤에 뭘 골라야 할지 고민하게 하면 안 눌러진다.
 * 그래서 사유는 다섯 개로 딱 자르고, 자세한 말은 선택으로 둔다.
 */
export type ReportCategory = "SEXUAL" | "ABUSE" | "ILLEGAL" | "PRIVACY" | "OTHER";
export type ReportTargetType = "STAFF" | "CUSTOMER" | "REVIEW" | "COMMENT" | "STORE";
export type ReporterType = "CUSTOMER" | "STAFF";
export type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export const REPORT_CATEGORIES: { key: ReportCategory; label: string; desc: string }[] = [
  { key: "SEXUAL", label: "성적인 요구·표현", desc: "성적 서비스를 요구하거나 암시하는 말·행동" },
  { key: "ABUSE", label: "욕설·폭언·협박", desc: "모욕, 위협, 집요한 연락" },
  { key: "ILLEGAL", label: "불법 행위 의심", desc: "성매매 알선, 미성년자, 허가 밖 영업 등" },
  { key: "PRIVACY", label: "개인정보 요구", desc: "실명·전화번호·SNS 등을 캐묻거나 퍼뜨림" },
  { key: "OTHER", label: "기타", desc: "위에 없는 문제" },
];

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = Object.fromEntries(REPORT_CATEGORIES.map((c) => [c.key, c.label])) as Record<ReportCategory, string>;

export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = {
  STAFF: "직원",
  CUSTOMER: "손님",
  REVIEW: "후기",
  COMMENT: "댓글",
  STORE: "매장",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: "확인 중",
  RESOLVED: "조치 완료",
  DISMISSED: "문제 없음",
};

export const REPORT_DETAIL_MAX = 300;

/** 하루에 같은 사람이 낼 수 있는 신고 수 — 신고 버튼으로 남을 괴롭히는 것도 막는다 */
export const REPORT_DAILY_LIMIT = 5;

export function isReportCategory(v: unknown): v is ReportCategory {
  return typeof v === "string" && REPORT_CATEGORIES.some((c) => c.key === v);
}
export function isReportTarget(v: unknown): v is ReportTargetType {
  return typeof v === "string" && v in REPORT_TARGET_LABEL;
}
