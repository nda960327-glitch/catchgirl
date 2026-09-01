"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
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
        {more ? "연결코드 접기 ▴" : "전에 매장에 다녀오셨나요? 연결코드 입력 ▾"}
      </button>
      {more && (
        <div className="animate-fade rounded-2xl border border-line bg-white/70 p-4">
          <Field label="연결코드" hint="매장에서 받은 코드">
            <Input name="inviteCode" placeholder="예: A3K9" maxLength={12} autoCapitalize="characters" className="uppercase" />
          </Field>
          <div className="mt-2 text-[11px] leading-[1.7] text-mute">
            카톡·전화로 예약하시던 분이라면 매장에서 연결코드를 받아 넣어주세요.
            그동안의 방문 기록을 새 계정 대신 <b className="text-ink">그대로 이어받아요</b>.
          </div>
        </div>
      )}

      <Button size="lg" type="submit" loading={pending} className="mt-2">시작하기</Button>
    </form>
  );
}
