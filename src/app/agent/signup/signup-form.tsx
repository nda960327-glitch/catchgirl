"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { signupAgent } from "../actions";

export function AgentSignupForm() {
  const [f, setF] = useState({ name: "", contact: "", loginId: "", password: "", password2: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = f.name.trim() && f.contact.trim() && f.loginId.trim().length >= 3 && f.password.length >= 6 && f.password === f.password2;

  return (
    <form
      className="mt-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (f.password !== f.password2) return setError("비밀번호 두 칸이 서로 달라요.");
        start(async () => {
          const r = await signupAgent({ name: f.name, contact: f.contact, loginId: f.loginId, password: f.password });
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <Field label="이름"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={20} className="h-11" autoFocus /></Field>
      <Field label="연락처" hint="운영사가 정산 때 연락할 전화나 텔레그램"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} maxLength={60} placeholder="010-0000-0000 또는 @telegram" className="h-11" /></Field>
      <Field label="로그인 아이디" hint="3자 이상 · 영문·숫자"><Input value={f.loginId} onChange={(e) => setF({ ...f, loginId: e.target.value.trim().toLowerCase() })} maxLength={30} className="h-11 font-mono" autoComplete="username" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="비밀번호" hint="6자 이상"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} maxLength={50} className="h-11" autoComplete="new-password" /></Field>
        <Field label="비밀번호 확인" hint={f.password2 && f.password !== f.password2 ? "서로 달라요" : ""}><Input type="password" value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} maxLength={50} className="h-11" autoComplete="new-password" /></Field>
      </div>
      {error && <div className="text-[12px] font-semibold text-bad">{error}</div>}
      <Button type="submit" loading={pending} disabled={!ready}>가입하고 내 코드 받기</Button>
    </form>
  );
}
