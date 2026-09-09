"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button, Card, Chip, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import type { ReportRow } from "@/lib/reports";
import { REPORT_CATEGORY_LABEL, REPORT_STATUS_LABEL, REPORT_TARGET_LABEL } from "@/lib/report-types";
import { resolveReportByStore } from "@/app/[slug]/report-actions";

/** 신고 대상으로 바로 가는 링크 — 관리자 화면 안에서 찾아 헤매지 않게 */
function targetHref(slug: string, r: ReportRow) {
  const base = `/${slug}/admin`;
  if (r.targetType === "STAFF") return `${base}/staff`;
  if (r.targetType === "CUSTOMER") return `${base}/customers`;
  if (r.targetType === "REVIEW" || r.targetType === "COMMENT") return `${base}/reviews`;
  return null;
}

export function ReportsAdmin({ slug, reports }: { slug: string; reports: ReportRow[] }) {
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const openCount = reports.filter((r) => r.status === "OPEN").length;
  const list = reports.filter((r) => (filter === "open" ? r.status === "OPEN" : r.status !== "OPEN"));

  const act = (id: string, status: "RESOLVED" | "DISMISSED" | "OPEN") =>
    start(async () => {
      const r = await resolveReportByStore(slug, id, status, noteFor === id ? note : "");
      toast(r.ok ? (status === "OPEN" ? "다시 열었어요" : "처리했어요. 운영사에도 같이 보여요.") : r.error, r.ok ? "success" : "error");
      if (r.ok) { setNoteFor(null); setNote(""); router.refresh(); }
    });

  return (
    <div className="mt-5">
      <div className="flex gap-1.5">
        {([["open", `확인 중 ${openCount}`], ["closed", `처리됨 ${reports.length - openCount}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full px-3.5 py-1.5 text-[11px] font-bold", filter === k ? "bg-ink text-on-ink" : "bg-well-2 text-mute", k === "open" && openCount > 0 && filter !== k && "text-bad")}>{l}</button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {list.length === 0 && (
          <Card className="p-8 text-center text-[12px] text-mute">{filter === "open" ? "확인할 신고가 없어요" : "처리한 신고가 없어요"}</Card>
        )}
        {list.map((r) => {
          const href = targetHref(slug, r);
          return (
            <Card key={r.id} className={cn("p-4", r.status === "OPEN" && "border-bad/40")}>
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <Chip tone={r.status === "OPEN" ? "red" : r.status === "RESOLVED" ? "green" : "mute"}>{REPORT_STATUS_LABEL[r.status]}</Chip>
                <Chip tone="gold">{REPORT_CATEGORY_LABEL[r.category]}</Chip>
                <span className="font-bold text-ink">
                  {REPORT_TARGET_LABEL[r.targetType]} · {r.targetName || "(이름 없음)"}
                </span>
                {href && <Link href={href} className="text-[11px] text-brand underline-offset-2 hover:underline">보러 가기 ↗</Link>}
                <span className="ml-auto text-[10px] text-mute">{format(new Date(r.createdAt), "yyyy.MM.dd HH:mm")}</span>
              </div>
              <div className="mt-1.5 text-[11px] text-mute">
                신고한 사람 · {r.reporterType === "CUSTOMER" ? "손님" : "직원"} {r.reporterName}
                <span className="ml-1 text-mute/70">(신고당한 쪽에는 보이지 않아요)</span>
              </div>
              {r.detail && <p className="mt-2 whitespace-pre-line rounded-xl bg-well px-3 py-2 text-[12px] leading-[1.7] text-ink">{r.detail}</p>}
              {r.status !== "OPEN" && (
                <div className="mt-2 text-[11px] text-mute">
                  {r.handledBy === "PLATFORM" ? "운영사가" : "매장이"} {r.resolvedAt ? format(new Date(r.resolvedAt), "M/d HH:mm") : ""} 처리
                  {r.adminNote && <span className="text-ink"> · {r.adminNote}</span>}
                </div>
              )}

              {r.status === "OPEN" ? (
                <div className="mt-3">
                  {noteFor === r.id ? (
                    <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="어떻게 조치했는지 (운영사도 봐요)" maxLength={300} />
                  ) : (
                    <button onClick={() => { setNoteFor(r.id); setNote(""); }} className="text-[11px] text-brand underline-offset-2 hover:underline">조치 내용 적기</button>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => act(r.id, "RESOLVED")} loading={pending}>조치 완료</Button>
                    <Button size="sm" variant="outline" onClick={() => act(r.id, "DISMISSED")} loading={pending}>문제 없음</Button>
                  </div>
                </div>
              ) : r.handledBy !== "PLATFORM" ? (
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => act(r.id, "OPEN")} loading={pending}>다시 열기</Button>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
