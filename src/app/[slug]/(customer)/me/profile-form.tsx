"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { changeMyPin, updateMyProfile } from "../actions";

type P = { nickname: string };

export function ProfileForm({ slug, me }: { slug: string; me: P }) {
  const [open, setOpen] = useState<"none" | "profile" | "pin">("none");
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  if (open === "none") {
    return (
      <Card className="mt-3 flex items-center gap-3 p-4 shadow-none">
        <div className="min-w-0 flex-1 text-[12px] text-mute">휴대폰 번호·실명 없이 닉네임과 PIN만 저장돼요</div>
        <Button size="sm" variant="secondary" onClick={() => setOpen("profile")}>내 정보</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen("pin")}>PIN 변경</Button>
      </Card>
    );
  }

  if (open === "pin") {
    return (
      <Card className="mt-3 p-4 shadow-none">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await changeMyPin(slug, String(fd.get("currentPin") ?? ""), String(fd.get("newPin") ?? ""));
              toast(r.ok ? "PIN을 변경했어요" : r.error, r.ok ? "success" : "error");
              if (r.ok) setOpen("none");
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="현재 PIN"><Input name="currentPin" type="password" inputMode="numeric" maxLength={6} required /></Field>
            <Field label="새 PIN" hint="숫자 4~6자리"><Input name="newPin" type="password" inputMode="numeric" maxLength={6} required /></Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={pending} className="flex-1">변경</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen("none")}>취소</Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="mt-3 p-4 shadow-none">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await updateMyProfile(slug, fd);
            toast(r.ok ? "내 정보를 저장했어요" : r.error, r.ok ? "success" : "error");
            if (r.ok) { setOpen("none"); router.refresh(); }
          });
        }}
      >
        <Field label="닉네임" hint="로그인에 쓰는 이름이에요">
          <Input name="nickname" defaultValue={me.nickname} maxLength={12} required />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" loading={pending} className="flex-1">저장</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen("none")}>취소</Button>
        </div>
      </form>
    </Card>
  );
}
