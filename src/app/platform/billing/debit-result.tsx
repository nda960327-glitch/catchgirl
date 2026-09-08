"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { markPaidBulk } from "../actions";

/** 출금 결과 붙여 넣기 — 성공한 회원번호만 받아 그 달 입금으로 표시한다 */
export function DebitResult({ month, readyMemberNos }: { month: string; readyMemberNos: string[] }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const nos = Array.from(new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)));

  const apply = (list: string[]) =>
    start(async () => {
      const r = await markPaidBulk(month, list);
      if (!r.ok) return toast(r.error, "error");
      toast(`${r.data!.marked}곳 입금 표시${r.data!.unknown.length ? ` · 못 찾은 번호 ${r.data!.unknown.length}개` : ""}`, r.data!.unknown.length ? "error" : "success");
      setText("");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={"성공한 회원번호를 붙여 넣기\n예)\n10023\n10031"} className="font-mono text-[12px]" />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => apply(nos)} loading={pending} disabled={nos.length === 0}>{nos.length}곳 입금 표시</Button>
        <Button size="sm" variant="outline" onClick={() => { if (confirm(`출금 예정 ${readyMemberNos.length}곳을 전부 입금으로 표시할까요?`)) apply(readyMemberNos); }} loading={pending} disabled={readyMemberNos.length === 0}>전부 성공 ({readyMemberNos.length}곳)</Button>
      </div>
    </div>
  );
}
