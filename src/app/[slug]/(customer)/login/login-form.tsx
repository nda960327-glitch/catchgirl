"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { REFERRALS } from "@/lib/utils";
import { loginCustomer } from "../actions";

export function LoginForm({ slug, next }: { slug: string; next?: string }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const [more, setMore] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await loginCustomer(slug, fd, next);
      if (r && !r.ok) toast(r.error, "error");
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="닉네임" hint="필수">
        <Input name="nickname" placeholder="예: 유나" maxLength={12} autoComplete="nickname" required />
      </Field>
      <Field label="휴대폰 번호" hint="필수 · 예약 확인용">
        <Input name="phone" placeholder="010-0000-0000" inputMode="tel" autoComplete="tel" required />
      </Field>

      <button type="button" onClick={() => setMore((v) => !v)} className="self-start text-[12px] font-semibold text-brand">
        {more ? "추가 정보 접기 ▴" : "추가 정보 입력하기 (선택) ▾"}
      </button>
      {more && (
        <div className="animate-fade flex flex-col gap-3 rounded-2xl border border-line bg-white/70 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름"><Input name="name" placeholder="홍길동" maxLength={20} autoComplete="name" /></Field>
            <Field label="생년월일"><Input name="birthday" type="date" /></Field>
            <Field label="성별">
              <Select name="gender" defaultValue="" className="h-12 w-full rounded-2xl">
                <option value="">선택</option><option value="F">여성</option><option value="M">남성</option><option value="N">선택 안 함</option>
              </Select>
            </Field>
            <Field label="방문 경로">
              <Select name="referral" defaultValue="" className="h-12 w-full rounded-2xl">
                <option value="">선택</option>
                {REFERRALS.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="인스타그램"><Input name="instagram" placeholder="@아이디" maxLength={40} /></Field>
          <Field label="이메일"><Input name="email" type="email" placeholder="you@example.com" maxLength={60} /></Field>
          <div className="text-[11px] text-mute">생일 쿠폰·이벤트 안내에 사용돼요. 마이페이지에서 언제든 수정할 수 있어요.</div>
        </div>
      )}
      <Button size="lg" type="submit" loading={pending} className="mt-2">시작하기</Button>
    </form>
  );
}
