"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Eyebrow, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { FIXED_NOTICE } from "@/lib/notices";
import { deleteNotice, saveNotice } from "../../actions";

export type NoticeItem = { id: string; title: string; body: string; isPinned: boolean; isActive: boolean };

const BLANK: NoticeItem = { id: "", title: "", body: "", isPinned: false, isActive: true };

/** 관리자 — 고객 홈에 뜨는 공지를 직접 쓰고 고친다 */
export function NoticesManager({ slug, items }: { slug: string; items: NoticeItem[] }) {
  const [editing, setEditing] = useState<NoticeItem | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const save = () => {
    if (!editing) return;
    start(async () => {
      const r = await saveNotice(slug, { ...editing, id: editing.id || undefined });
      if (!r.ok) return toast(r.error, "error");
      toast("저장했어요", "success");
      setEditing(null);
      router.refresh();
    });
  };

  const remove = (n: NoticeItem) =>
    start(async () => {
      if (!confirm(`'${n.title}' 공지를 삭제할까요?`)) return;
      const r = await deleteNotice(slug, n.id);
      if (!r.ok) return toast(r.error, "error");
      toast("삭제했어요", "success");
      router.refresh();
    });

  return (
    <Card className="mt-5 p-5">
      <Eyebrow>Notice</Eyebrow>
      <div className="mt-1 text-[14px] font-bold text-ink">공지사항</div>
      <p className="mt-1 text-[12px] text-mute">고객 홈 화면에 그대로 보여요. <b className="text-ink">필독</b>으로 지정하면 맨 위에 강조돼요.</p>

      <div className="mt-4 flex flex-col gap-2.5">
        {/* 고정 안내 — 코드에 박혀 있어 여기서도 손댈 수 없다 */}
        <div className="rounded-2xl border border-gold/40 bg-well p-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone="gold">고정</Chip>
            <span className="text-[13px] font-bold text-ink">{FIXED_NOTICE.title}</span>
            <span className="ml-auto text-[10px] font-semibold text-mute">수정·삭제 불가</span>
          </div>
          <p className="mt-1.5 whitespace-pre-line text-[12px] leading-[1.7] text-mute">{FIXED_NOTICE.body}</p>
          <p className="mt-2 text-[10px] leading-[1.7] text-mute">
            이 앱이 무엇을 예약하는 곳인지 밝혀 두는 안내예요. 고객 홈 공지 맨 위에 늘 보이고, 매장에서 고치거나 내릴 수 없어요.
          </p>
        </div>
        {items.length === 0 && <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">아직 매장 공지가 없어요</div>}
        {items.map((n) => (
          <div key={n.id} className="rounded-2xl border border-line bg-card p-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {n.isPinned && <Chip>필독</Chip>}
              {!n.isActive && <Chip tone="mute">숨김</Chip>}
              <span className="text-[13px] font-bold text-ink">{n.title}</span>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setEditing(n)}>수정</Button>
                <button onClick={() => remove(n)} disabled={pending} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-mute hover:text-bad">삭제</button>
              </div>
            </div>
            <p className="mt-1.5 whitespace-pre-line text-[12px] leading-[1.7] text-mute">{n.body}</p>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand/40 bg-blush-lt/40 p-4">
          <div className="text-[13px] font-bold text-ink">{editing.id ? "공지 수정" : "새 공지"}</div>
          <Field label="제목" hint="40자까지">
            <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={40} className="h-11 text-[13px]" />
          </Field>
          <Field label="내용" hint="줄바꿈 그대로 보여요">
            <Textarea rows={5} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} maxLength={1000} />
          </Field>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-mute">
              <input type="checkbox" checked={editing.isPinned} onChange={(e) => setEditing({ ...editing, isPinned: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
              필독 (맨 위 고정)
            </label>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-mute">
              <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
              고객에게 노출
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} loading={pending} className="flex-1" disabled={!editing.title.trim() || !editing.body.trim()}>저장</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>취소</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setEditing(BLANK)} className="mt-3">+ 공지 추가</Button>
      )}
    </Card>
  );
}
