"use client";

import { useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { loginAdmin } from "../actions";

export function AdminLoginForm({ slug, next }: { slug: string; next?: string }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  return (
    <form
      className="mt-7 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await loginAdmin(slug, fd, next);
          if (r && !r.ok) toast(r.error, "error");
        });
      }}
    >
      <Field label="이메일"><Input name="email" type="email" defaultValue="admin@catchgirl.app" required autoComplete="username" /></Field>
      <Field label="비밀번호"><Input name="password" type="password" defaultValue="1234" required autoComplete="current-password" /></Field>
      <Button size="lg" type="submit" loading={pending}>로그인</Button>
    </form>
  );
}
