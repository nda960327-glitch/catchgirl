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
      <Field label="닉네임" hint="매장에서 불릴 이름">
        <Input name="nickname" placeholder="예: 길동" maxLength={12} autoComplete="nickname" required />
      </Field>
      <Field label="PIN" hint="숫자 4~6자리 · 다음에 다시 들어올 때 필요해요">
        <Input name="pin" type="password" placeholder="••••" inputMode="numeric" pattern="\d{4,6}" maxLength={6} autoComplete="current-password" required />
      </Field>
      <div className="rounded-2xl bg-blush-lt/60 px-4 py-3 text-[11px] leading-[1.7] text-mute">
        휴대폰 번호·실명은 받지 않아요. 처음 쓰는 닉네임이면 이대로 시작되고,
        다음부턴 <b className="text-ink">같은 닉네임 + PIN</b> 으로 예약 내역을 불러와요.
      </div>

      <button type="button" onClick={() => setMore((v) => !v)} className="self-start text-[12px] font-semibold text-brand">
        {more ? "방문 경로 접기 ▴" : "방문 경로 알려주기 (선택) ▾"}
      </button>
      {more && (
        <div className="animate-fade rounded-2xl border border-line bg-white/70 p-4">
          <Field label="방문 경로">
            <Select name="referral" defaultValue="" className="h-12 w-full rounded-2xl">
              <option value="">선택</option>
              {REFERRALS.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
        </div>
      )}
      <Button size="lg" type="submit" loading={pending} className="mt-2">시작하기</Button>
    </form>
  );
}
