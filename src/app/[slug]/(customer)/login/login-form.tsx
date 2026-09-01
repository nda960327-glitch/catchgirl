"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import { loginCustomer } from "../actions";

export function LoginForm({ slug, next }: { slug: string; next?: string }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const [mode, setMode] = useState<"first" | "again">("first");

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
      {/* 초대받은 분만 쓰는 공간이라, 처음 시작할 땐 코드가 반드시 있어야 한다 */}
      <div className="flex rounded-2xl bg-[#F4EDEE] p-1">
        {([
          ["first", "처음이에요"],
          ["again", "전에 왔어요"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={cn("flex-1 rounded-xl py-2.5 text-[12px] font-bold transition-all", mode === k ? "bg-white text-ink shadow-card" : "text-mute")}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "first" ? (
        <>
          <Field label="연결코드" hint="매장에서 받은 코드">
            <Input name="inviteCode" placeholder="예: A3K9" maxLength={12} autoCapitalize="characters" className="uppercase tracking-[.2em]" required />
          </Field>
          <div className="rounded-2xl bg-blush-lt/60 px-4 py-3 text-[11px] leading-[1.7] text-mute">
            초대받은 분만 이용하실 수 있어요. 코드가 없으시면 매장에 말씀해 주세요.
            <br />전에 카톡·전화로 예약하셨다면 그동안의 방문 기록도 <b className="text-ink">그대로 이어받아요</b>.
          </div>
        </>
      ) : (
        <div className="rounded-2xl bg-blush-lt/60 px-4 py-3 text-[11px] leading-[1.7] text-mute">
          한 번 시작하신 뒤로는 <b className="text-ink">닉네임 + PIN</b> 으로 바로 들어오실 수 있어요.
          <br />PIN을 잊으셨다면 매장에 말씀해 주세요.
        </div>
      )}

      <Button size="lg" type="submit" loading={pending} className="mt-2">{mode === "first" ? "시작하기" : "들어가기"}</Button>
    </form>
  );
}
