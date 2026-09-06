"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { loginPlatform } from "../actions";

export function PlatformLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await loginPlatform(fd);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <Field label="비밀번호">
        <Input name="password" type="password" autoFocus className="h-11" />
      </Field>
      {error && <div className="text-[12px] font-semibold text-[#C0392B]">{error}</div>}
      <Button type="submit" loading={pending}>들어가기</Button>
    </form>
  );
}
