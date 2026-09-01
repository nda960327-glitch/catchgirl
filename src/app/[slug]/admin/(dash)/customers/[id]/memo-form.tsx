"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { REFERRALS } from "@/lib/utils";
import { addCustomerNote, deleteCustomerNote, saveCustomerInfo } from "../../../actions";

export type CustomerInfo = { nickname: string; referral: string; adminMemo: string; isBlacklisted: boolean };
export type NoteItem = { id: string; authorName: string; content: string; createdAt: string };

/** 관리자 — 고객 기본 정보 + 상단 고정 메모 */
export function CustomerInfoForm({ slug, customerId, init }: { slug: string; customerId: string; init: CustomerInfo }) {
  const [f, setF] = useState(init);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const set = (k: keyof CustomerInfo, v: string | boolean) => setF({ ...f, [k]: v });

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="닉네임"><Input value={f.nickname} onChange={(e) => set("nickname", e.target.value)} className="h-10 text-[13px]" /></Field>
        <Field label="방문 경로">
          <Select value={f.referral} onChange={(e) => set("referral", e.target.value)} className="h-10 w-full">
            <option value="">미입력</option>{REFERRALS.map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="고정 메모" hint="고객 목록·예약 화면에 항상 같이 보여요">
        <Textarea rows={3} value={f.adminMemo} onChange={(e) => set("adminMemo", e.target.value)} placeholder="예: 조용한 대화 선호, 창가 자리" />
      </Field>
      <label className="flex items-center gap-2 text-[12px] font-semibold text-[#C0392B]">
        <input type="checkbox" checked={f.isBlacklisted} onChange={(e) => set("isBlacklisted", e.target.checked)} className="h-4 w-4 accent-[#C0392B]" /> 블랙리스트 지정 (고객 예약 차단)
      </label>
      <Button
        onClick={() => start(async () => { const r = await saveCustomerInfo(slug, customerId, f); toast(r.ok ? "저장했어요" : r.error, r.ok ? "success" : "error"); if (r.ok) router.refresh(); })}
        loading={pending}
      >
        저장
      </Button>
    </div>
  );
}

/** 관리자 — 방문마다 쌓는 시간순 메모 */
export function CustomerNotes({ slug, customerId, notes }: { slug: string; customerId: string; notes: NoteItem[] }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const add = () => {
    if (!text.trim()) return;
    start(async () => {
      const r = await addCustomerNote(slug, customerId, text);
      if (!r.ok) return toast(r.error, "error");
      setText("");
      toast("메모를 남겼어요", "success");
      router.refresh();
    });
  };
  const remove = (id: string) => {
    if (!confirm("이 메모를 지울까요?")) return;
    start(async () => {
      const r = await deleteCustomerNote(slug, id);
      if (!r.ok) return toast(r.error, "error");
      router.refresh();
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-3">
      <Textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); }}
        placeholder="오늘 이 손님에 대해 기억해 둘 것 (⌘/Ctrl + Enter 로 저장)"
      />
      <Button size="sm" onClick={add} loading={pending} disabled={!text.trim()}>메모 남기기</Button>

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">아직 남긴 메모가 없어요</div>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <div key={n.id} className="group rounded-2xl border border-line bg-white p-3">
              <div className="flex items-center gap-2 text-[10px] text-mute">
                <span className="font-semibold text-ink">{n.authorName}</span>
                <span>{n.createdAt}</span>
                <button onClick={() => remove(n.id)} className="ml-auto text-mute opacity-0 transition-opacity hover:text-[#C0392B] group-hover:opacity-100">삭제</button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[12px] leading-[1.7] text-ink">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
