"use client";

import { useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { loginStaff } from "../actions";

export function StaffLoginForm({ slug, next }: { slug: string; next?: string }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  return (
    <form
      className="mt-6 flex flex-col gap-4 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await loginStaff(slug, fd, next);
          if (r && !r.ok) toast(r.error, "error");
        });
      }}
    >
      <Field label="로그인 ID"><Input name="loginId" defaultValue="junhee" required autoComplete="username" /></Field>
      <Field label="비밀번호"><Input name="password" type="password" defaultValue="1234" required autoComplete="current-password" /></Field>
      <Button size="lg" type="submit" loading={pending}>로그인</Button>
    </form>
  );
}
