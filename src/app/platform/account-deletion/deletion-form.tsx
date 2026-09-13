"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { deleteAccountFromWeb } from "./actions";

export function DeletionForm() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const el = e.currentTarget;
        const fd = new FormData(el);
        start(async () => {
          const r = await deleteAccountFromWeb(fd);
          setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
          if (r.ok) el.reset();
        });
      }}
    >
      <Field label="매장 주소" hint="예: secret-garden.catchgirl.kr">
        <Input name="store" required placeholder="매장 앱 주소" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="닉네임">
          <Input name="nickname" required maxLength={20} autoComplete="username" />
        </Field>
        <Field label="PIN">
          <Input name="pin" type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} required autoComplete="current-password" />
        </Field>
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex items-start gap-2 text-[11px] leading-[1.6] text-mute">
        <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 shrink-0 accent-[#B4586A]" />
        <span>아래 지워지는 내용을 읽었고, 삭제는 되돌릴 수 없다는 걸 알아요.</span>
      </label>
      {msg && (
        <div className={cn("rounded-xl px-3 py-2 text-[12px] font-bold", msg.ok ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad")} role="status">
          {msg.text}
        </div>
      )}
      <Button type="submit" variant="danger" loading={pending}>계정 삭제</Button>
    </form>
  );
}
