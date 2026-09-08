"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { won } from "@/lib/utils";
import { createAgent, setAgentPassword, updateAgent } from "../actions";

export type AgentRow = {
  id: string; name: string; code: string; contact: string; loginId: string; isActive: boolean;
  storeCount: number; confirmed: number; paid: number; pending: number;
};

const BLANK = { name: "", code: "", contact: "", loginId: "", password: "" };

/** 담당직원 계정 만들기·수정. 코드는 이름에서 자동으로 제안하고 고칠 수 있다. */
export function AgentsManager({ rows }: { rows: AgentRow[] }) {
  const [f, setF] = useState(BLANK);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", contact: "", isActive: true });
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const suggestCode = (name: string) => {
    const base = name.replace(/[^A-Za-z0-9가-힣]/g, "").slice(0, 3).toUpperCase() || "AG";
    return `${base}${String(rows.length + 1).padStart(2, "0")}`;
  };

  const create = () =>
    start(async () => {
      const r = await createAgent(f);
      if (!r.ok) return toast(r.error, "error");
      toast(`${f.name} 계정을 만들었어요. 아이디와 비밀번호를 알려 주세요.`, "success");
      setF(BLANK);
      router.refresh();
    });

  const save = (id: string) =>
    start(async () => {
      const r = await updateAgent(id, edit);
      if (!r.ok) return toast(r.error, "error");
      toast("저장했어요", "success");
      setEditing(null);
      router.refresh();
    });

  const resetPw = (id: string, name: string) =>
    start(async () => {
      const pw = prompt(`${name}의 새 비밀번호 (6자 이상)`);
      if (pw === null) return;
      const r = await setAgentPassword(id, pw);
      if (!r.ok) return toast(r.error, "error");
      toast("비밀번호를 바꿨어요. 직원에게 알려 주세요.", "success");
    });

  return (
    <div>
      <div className="text-[14px] font-bold text-ink">새 담당직원</div>
      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <Field label="이름"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, code: f.code || suggestCode(e.target.value) })} maxLength={20} className="h-10 text-[12px]" /></Field>
        <Field label="코드" hint="신청서에 적는 것"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} maxLength={10} className="h-10 font-mono text-[12px]" /></Field>
        <Field label="연락처"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} maxLength={60} className="h-10 text-[12px]" placeholder="010-… / @tg" /></Field>
        <Field label="로그인 아이디"><Input value={f.loginId} onChange={(e) => setF({ ...f, loginId: e.target.value.trim() })} maxLength={30} className="h-10 font-mono text-[12px]" /></Field>
        <Field label="비밀번호" hint="6자 이상"><Input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} maxLength={50} className="h-10 font-mono text-[12px]" /></Field>
      </div>
      <Button size="sm" onClick={create} loading={pending} disabled={!f.name || !f.code || !f.loginId || f.password.length < 6} className="mt-3">+ 만들기</Button>

      <div className="mt-6 text-[14px] font-bold text-ink">직원 {rows.length}명</div>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows.length === 0 && <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">아직 없어요</div>}
        {rows.map((a) => (
          <div key={a.id} className={`rounded-2xl border border-line bg-card p-3.5 ${!a.isActive ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-ink">{a.name}</span>
              <span className="rounded-md bg-well px-1.5 py-0.5 font-mono text-[11px] text-ink">{a.code}</span>
              {!a.isActive && <Chip tone="mute">비활성</Chip>}
              <span className="text-[11px] text-mute">아이디 {a.loginId}{a.contact ? ` · ${a.contact}` : ""}</span>
              <div className="ml-auto flex gap-1.5">
                <button onClick={() => { setEditing(editing === a.id ? null : a.id); setEdit({ name: a.name, contact: a.contact, isActive: a.isActive }); }} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-ink hover:border-brand">{editing === a.id ? "닫기" : "수정"}</button>
                <button onClick={() => resetPw(a.id, a.name)} disabled={pending} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-mute hover:text-ink">비밀번호</button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
              <div className="rounded-xl bg-well px-3 py-2"><div className="text-mute">매장</div><div className="font-bold text-ink">{a.storeCount}곳</div></div>
              <div className="rounded-xl bg-well px-3 py-2"><div className="text-mute">지급 대기</div><div className="font-bold text-brand">{won(a.confirmed)}</div></div>
              <div className="rounded-xl bg-well px-3 py-2"><div className="text-mute">대기 중</div><div className="font-bold text-ink">{won(a.pending)}</div></div>
              <div className="rounded-xl bg-well px-3 py-2"><div className="text-mute">지급 완료</div><div className="font-bold text-ink">{won(a.paid)}</div></div>
            </div>
            {editing === a.id && (
              <div className="mt-3 flex flex-wrap items-end gap-2.5 border-t border-line pt-3">
                <Field label="이름" className="min-w-[120px]"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={20} className="h-10 text-[12px]" /></Field>
                <Field label="연락처" className="min-w-[160px] flex-1"><Input value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} maxLength={60} className="h-10 text-[12px]" /></Field>
                <label className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-mute">
                  <input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
                  활동 중 (끄면 로그인·코드 사용 불가)
                </label>
                <Button size="sm" onClick={() => save(a.id)} loading={pending} className="mb-1">저장</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
