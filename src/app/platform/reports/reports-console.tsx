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
import { resolveReportByPlatform } from "../actions";

type Row = ReportRow & { store: { name: string; slug: string; isSuspended: boolean } };

export function ReportsConsole({ reports }: { reports: Row[] }) {
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const openCount = reports.filter((r) => r.status === "OPEN").length;
  const list = reports.filter((r) => (filter === "all" ? true : filter === "open" ? r.status === "OPEN" : r.status !== "OPEN"));

  // 매장별로 열린 신고가 몇 건인지 — 반복되는 곳이 한눈에 보이게
  const perStore = new Map<string, number>();
  for (const r of reports) if (r.status === "OPEN") perStore.set(r.store.slug, (perStore.get(r.store.slug) ?? 0) + 1);

  const act = (id: string, status: "RESOLVED" | "DISMISSED" | "OPEN") =>
    start(async () => {
      const r = await resolveReportByPlatform(id, status, noteFor === id ? note : "");
      toast(r.ok ? "처리했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) { setNoteFor(null); setNote(""); router.refresh(); }
    });

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-1.5">
        {([["open", `확인 중 ${openCount}`], ["closed", `처리됨 ${reports.length - openCount}`], ["all", "전체"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full px-3.5 py-1.5 text-[11px] font-bold", filter === k ? "bg-ink text-on-ink" : "bg-well-2 text-mute", k === "open" && openCount > 0 && filter !== k && "text-bad")}>{l}</button>
        ))}
      </div>

      {perStore.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {[...perStore.entries()].sort((a, b) => b[1] - a[1]).map(([slug, n]) => (
            <Link key={slug} href={`/platform/${slug}`} className={cn("rounded-full px-2.5 py-1 font-bold", n >= 3 ? "bg-bad-bg text-bad" : "bg-blush-lt text-brand")}>/{slug} · {n}건</Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {list.length === 0 && <Card className="p-8 text-center text-[12px] text-mute">신고가 없어요</Card>}
        {list.map((r) => (
          <Card key={r.id} className={cn("p-4", r.status === "OPEN" && "border-bad/40")}>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <Chip tone={r.status === "OPEN" ? "red" : r.status === "RESOLVED" ? "green" : "mute"}>{REPORT_STATUS_LABEL[r.status]}</Chip>
              <Chip tone="gold">{REPORT_CATEGORY_LABEL[r.category]}</Chip>
              <Link href={`/platform/${r.store.slug}`} className="font-bold text-brand underline-offset-2 hover:underline">{r.store.name}</Link>
              {r.store.isSuspended && <Chip tone="mute">정지 중</Chip>}
              <span className="text-ink">{REPORT_TARGET_LABEL[r.targetType]} · {r.targetName || "(이름 없음)"}</span>
              <span className="ml-auto text-[10px] text-mute">{format(new Date(r.createdAt), "yyyy.MM.dd HH:mm")}</span>
            </div>
            <div className="mt-1.5 text-[11px] text-mute">신고한 사람 · {r.reporterType === "CUSTOMER" ? "손님" : "직원"} {r.reporterName}</div>
            {r.detail && <p className="mt-2 whitespace-pre-line rounded-xl bg-well px-3 py-2 text-[12px] leading-[1.7] text-ink">{r.detail}</p>}
            {r.status !== "OPEN" && (
              <div className="mt-2 text-[11px] text-mute">
                {r.handledBy === "PLATFORM" ? "운영사가" : "매장이"} {r.resolvedAt ? format(new Date(r.resolvedAt), "M/d HH:mm") : ""} 처리
                {r.adminNote && <span className="text-ink"> · {r.adminNote}</span>}
              </div>
            )}
            <div className="mt-3">
              {r.status === "OPEN" && (
                noteFor === r.id ? (
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="처리 메모 (매장 관리자도 봐요)" maxLength={300} />
                ) : (
                  <button onClick={() => { setNoteFor(r.id); setNote(""); }} className="text-[11px] text-brand underline-offset-2 hover:underline">처리 메모 적기</button>
                )
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {r.status === "OPEN" ? (
                  <>
                    <Button size="sm" onClick={() => act(r.id, "RESOLVED")} loading={pending}>조치 완료</Button>
                    <Button size="sm" variant="outline" onClick={() => act(r.id, "DISMISSED")} loading={pending}>문제 없음</Button>
                    <Link href={`/platform/${r.store.slug}`} className="ml-auto rounded-xl bg-bad-bg px-3 py-2 text-[12px] font-bold text-bad">매장 페이지에서 정지 →</Link>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => act(r.id, "OPEN")} loading={pending}>다시 열기</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
