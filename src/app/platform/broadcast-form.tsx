"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { broadcastNotice } from "./actions";

/** 점검 안내처럼 모든 업체 손님 화면에 한 번에 띄우는 공지 */
export function BroadcastForm() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", body: "", isPinned: true });
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const send = () =>
    start(async () => {
      if (!confirm("모든 업체의 손님 화면에 이 공지를 올릴까요? 업체마다 공지 목록에 들어가고, 업체가 나중에 지울 수 있어요.")) return;
      const r = await broadcastNotice(f);
      if (!r.ok) return toast(r.error, "error");
      toast(`${r.data?.count}곳에 올렸어요`, "success");
      setF({ title: "", body: "", isPinned: true });
      setOpen(false);
      router.refresh();
    });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[14px] font-bold text-ink">전체 공지</div>
          <div className="mt-0.5 text-[11px] text-mute">점검·업데이트 안내를 모든 업체 손님 화면에 한 번에 올려요</div>
        </div>
        {!open && <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>공지 쓰기</Button>}
      </div>
      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <Field label="제목"><Input value={f.title} maxLength={40} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="예: 9월 20일 새벽 점검 안내" className="h-11" /></Field>
          <Field label="내용"><Textarea rows={4} maxLength={1000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="새벽 4시~5시 사이 앱이 잠시 멈출 수 있어요." /></Field>
          <label className="flex items-center gap-1.5 text-[12px] font-semibold text-mute">
            <input type="checkbox" checked={f.isPinned} onChange={(e) => setF({ ...f, isPinned: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
            필독으로 맨 위에
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={send} loading={pending} disabled={!f.title.trim() || !f.body.trim()}>모든 업체에 올리기</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>취소</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
