"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { addCustomerNote, deleteCustomerNote, issueInviteCode, resetCustomerPin, saveCustomerInfo } from "../../../actions";

export type CustomerInfo = { nickname: string; adminMemo: string; isBlacklisted: boolean };
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
      <Field label="닉네임"><Input value={f.nickname} onChange={(e) => set("nickname", e.target.value)} className="h-10 text-[13px]" /></Field>
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

/**
 * 계정 연결 — 카톡·전화로만 오가던 손님이 앱에서 새 닉네임을 만들면 이력이 갈라진다.
 * 여기서 코드를 발급해 알려주면, 손님이 첫 로그인 때 그 기록을 그대로 이어받는다.
 */
export function CustomerAccount({
  slug, customerId, inviteCode, hasPin,
}: {
  slug: string;
  customerId: string;
  inviteCode: string | null;
  hasPin: boolean;
}) {
  const [code, setCode] = useState(inviteCode);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const issue = () =>
    start(async () => {
      const r = await issueInviteCode(slug, customerId);
      if (!r.ok) return toast(r.error, "error");
      setCode(r.data!.code);
      toast("연결코드를 발급했어요", "success");
      router.refresh();
    });

  const resetPin = () =>
    start(async () => {
      if (!confirm("PIN을 초기화할까요?\n\n손님이 다음 로그인 때 새 PIN을 정하게 됩니다.")) return;
      const r = await resetCustomerPin(slug, customerId);
      if (!r.ok) return toast(r.error, "error");
      toast("PIN을 초기화했어요", "success");
      router.refresh();
    });

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="rounded-2xl bg-[#FAF6F7] px-4 py-3">
        <div className="text-[11px] font-semibold text-mute">연결코드</div>
        {code ? (
          <>
            <div className="mt-1 font-serif text-[26px] font-bold tracking-[.2em] text-brand">{code}</div>
            <div className="mt-1 text-[11px] leading-[1.7] text-mute">
              손님께 이 코드를 알려주세요. 앱 첫 화면 <b className="text-ink">&ldquo;연결코드 입력&rdquo;</b>에 넣으면
              지금까지의 방문 기록을 그대로 이어받아요. 한 번 쓰면 사라집니다.
            </div>
          </>
        ) : (
          <div className="mt-1 text-[12px] text-mute">아직 발급된 코드가 없어요.</div>
        )}
        <Button size="sm" variant="secondary" onClick={issue} loading={pending} className="mt-2">
          {code ? "새 코드로 다시 발급" : "연결코드 발급"}
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-[#FAF6F7] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-mute">PIN</div>
          <div className="mt-0.5 text-[12px] text-ink">{hasPin ? "설정됨 (매장은 볼 수 없어요)" : "미설정 — 다음 로그인 때 정해요"}</div>
        </div>
        <Button size="sm" variant="outline" onClick={resetPin} loading={pending} disabled={!hasPin}>초기화</Button>
      </div>
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
