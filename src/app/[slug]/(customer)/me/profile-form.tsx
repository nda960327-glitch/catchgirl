"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { GENDER_LABEL, REFERRALS } from "@/lib/utils";
import { updateMyProfile } from "../actions";

type P = { nickname: string; phone: string; name: string; email: string; birthday: string; gender: string; instagram: string; referral: string };

export function ProfileForm({ slug, me }: { slug: string; me: P }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const filled = [me.name, me.birthday, me.gender, me.instagram].filter(Boolean).length;

  if (!open) {
    return (
      <Card className="mt-3 flex items-center gap-3 p-4 shadow-none">
        <div className="min-w-0 flex-1 text-[12px] text-mute">
          {filled === 0 ? "이름·생일·인스타를 남기면 생일 쿠폰과 이벤트를 챙겨드려요" : (
            <>
              {me.name && <span className="mr-2 text-ink">{me.name}</span>}
              {me.birthday && <span className="mr-2">🎂 {me.birthday.replace(/-/g, ".")}</span>}
              {me.gender && <span className="mr-2">{GENDER_LABEL[me.gender]}</span>}
              {me.instagram && <span className="mr-2">@{me.instagram}</span>}
            </>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>내 정보 {filled ? "수정" : "입력"}</Button>
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
            if (r.ok) { setOpen(false); router.refresh(); }
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="닉네임"><Input name="nickname" defaultValue={me.nickname} maxLength={12} required /></Field>
          <Field label="휴대폰"><Input value={me.phone} readOnly className="bg-[#FAF6F7]" /></Field>
          <Field label="이름"><Input name="name" defaultValue={me.name} maxLength={20} /></Field>
          <Field label="생년월일"><Input name="birthday" type="date" defaultValue={me.birthday} /></Field>
          <Field label="성별">
            <Select name="gender" defaultValue={me.gender} className="h-12 w-full rounded-2xl">
              <option value="">선택</option><option value="F">여성</option><option value="M">남성</option><option value="N">선택 안 함</option>
            </Select>
          </Field>
          <Field label="방문 경로">
            <Select name="referral" defaultValue={me.referral} className="h-12 w-full rounded-2xl">
              <option value="">선택</option>{REFERRALS.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="인스타그램"><Input name="instagram" defaultValue={me.instagram} placeholder="@아이디" /></Field>
        <Field label="이메일"><Input name="email" type="email" defaultValue={me.email} /></Field>
        <div className="flex gap-2">
          <Button type="submit" loading={pending} className="flex-1">저장</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>취소</Button>
        </div>
      </form>
    </Card>
  );
}
