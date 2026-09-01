"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { REFERRALS } from "@/lib/utils";
import { saveCustomerInfo } from "../../../actions";

export type CustomerInfo = { nickname: string; phone: string; name: string; email: string; birthday: string; gender: string; instagram: string; referral: string; adminMemo: string; isBlacklisted: boolean };

/** 관리자 — 고객 정보 전체 편집 (연락처·이름·생일·성별·인스타·방문 경로·메모·블랙리스트) */
export function CustomerInfoForm({ slug, customerId, init }: { slug: string; customerId: string; init: CustomerInfo }) {
  const [f, setF] = useState(init);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const set = (k: keyof CustomerInfo, v: string | boolean) => setF({ ...f, [k]: v });

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="닉네임"><Input value={f.nickname} onChange={(e) => set("nickname", e.target.value)} className="h-10 text-[13px]" /></Field>
        <Field label="휴대폰"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" className="h-10 text-[13px]" /></Field>
        <Field label="이름"><Input value={f.name} onChange={(e) => set("name", e.target.value)} className="h-10 text-[13px]" /></Field>
        <Field label="생년월일"><Input type="date" value={f.birthday} onChange={(e) => set("birthday", e.target.value)} className="h-10 text-[13px]" /></Field>
        <Field label="성별">
          <Select value={f.gender} onChange={(e) => set("gender", e.target.value)} className="h-10 w-full">
            <option value="">미입력</option><option value="F">여성</option><option value="M">남성</option><option value="N">선택 안 함</option>
          </Select>
        </Field>
        <Field label="방문 경로">
          <Select value={f.referral} onChange={(e) => set("referral", e.target.value)} className="h-10 w-full">
            <option value="">미입력</option>{REFERRALS.map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="인스타그램"><Input value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="아이디" className="h-10 text-[13px]" /></Field>
        <Field label="이메일"><Input value={f.email} onChange={(e) => set("email", e.target.value)} className="h-10 text-[13px]" /></Field>
      </div>
      <Field label="관리자 전용 메모" hint="고객에겐 안 보임">
        <Textarea rows={4} value={f.adminMemo} onChange={(e) => set("adminMemo", e.target.value)} placeholder="예: 조용한 대화 선호, 창가 자리" />
      </Field>
      <label className="flex items-center gap-2 text-[12px] font-semibold text-[#C0392B]">
        <input type="checkbox" checked={f.isBlacklisted} onChange={(e) => set("isBlacklisted", e.target.checked)} className="h-4 w-4 accent-[#C0392B]" /> 블랙리스트 지정 (고객 예약 차단)
      </label>
      <Button
        onClick={() => start(async () => { const r = await saveCustomerInfo(slug, customerId, f); toast(r.ok ? "저장했어요" : r.error, r.ok ? "success" : "error"); if (r.ok) router.refresh(); })}
        loading={pending}
      >
        저장
      </Button>
    </div>
  );
}
