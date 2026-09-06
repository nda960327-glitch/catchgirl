"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { PLANS, billedPrice, type Plan } from "@/lib/plans";
import { won } from "@/lib/utils";
import { enterStoreAsAdmin, setStoreAdminLogin, updateStoreFromPlatform } from "./actions";

/**
 * 업체 한 곳의 계약·계정 관리.
 *
 * 요금제, 업체 쪽 담당자 연락처, 그 업체에 대한 메모, 그리고 업체 관리자 계정.
 * 여기 적는 연락처와 메모는 업체의 관리자 화면에 절대 나가지 않는다 —
 * 파는 쪽이 보는 기록이다.
 *
 * "관리자로 들어가기" 는 그 업체 관리자 화면에 바로 들어가 대신 손봐 주는 길이다.
 * 설정 화면을 여기 또 만들지 않고, 업체가 쓰는 화면 그대로 쓴다.
 */
export function StoreCardEditor({
  slug, plan, ownerContact, platformMemo, adminEmail,
}: {
  slug: string;
  plan: Plan;
  ownerContact: string;
  platformMemo: string;
  adminEmail: string;
}) {
  const [open, setOpen] = useState<false | "contract" | "account">(false);
  const [f, setF] = useState({ plan, ownerContact, platformMemo });
  const [acct, setAcct] = useState({ email: adminEmail, password: "" });
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const saveContract = () =>
    start(async () => {
      const r = await updateStoreFromPlatform(slug, f);
      if (!r.ok) return toast(r.error, "error");
      toast("저장했어요", "success");
      setOpen(false);
      router.refresh();
    });

  const saveAccount = () =>
    start(async () => {
      const r = await setStoreAdminLogin(slug, acct);
      if (!r.ok) return toast(r.error, "error");
      toast("관리자 계정을 바꿨어요. 업체에 새 정보를 알려 주세요.", "success");
      setAcct({ ...acct, password: "" });
      setOpen(false);
      router.refresh();
    });

  const enter = () =>
    start(async () => {
      const r = await enterStoreAsAdmin(slug);
      if (r && !r.ok) toast(r.error, "error");
    });

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {ownerContact ? <span className="font-semibold text-ink">{ownerContact}</span> : <span className="text-mute">담당자 연락처 없음</span>}
        {platformMemo && <span className="min-w-0 truncate text-mute" title={platformMemo}>· {platformMemo}</span>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button onClick={() => setOpen(open === "contract" ? false : "contract")} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-ink hover:border-brand">계약 정보</button>
          <button onClick={() => setOpen(open === "account" ? false : "account")} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-ink hover:border-brand">관리자 계정</button>
          <button onClick={enter} disabled={pending} className="rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-bold text-white shadow-cta disabled:opacity-50">관리자로 들어가기 ↗</button>
        </div>
      </div>

      {open === "contract" && (
        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-brand/40 bg-blush-lt/30 p-3.5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="요금제" hint={`${won(billedPrice(f.plan))}/월 · 바꾸면 오늘부터 새로 세요`}>
              <Select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as Plan })} className="w-full">
                {(Object.keys(PLANS) as Plan[]).map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
              </Select>
            </Field>
            <Field label="업체 담당자 연락처" hint="사장·실장 전화나 텔레그램">
              <Input value={f.ownerContact} maxLength={120} onChange={(e) => setF({ ...f, ownerContact: e.target.value })} placeholder="010-0000-0000 · @telegram" className="h-11" />
            </Field>
          </div>
          <Field label="메모" hint="이 업체만 보는 기록 — 업체 화면엔 안 나가요">
            <Textarea rows={3} maxLength={1000} value={f.platformMemo} onChange={(e) => setF({ ...f, platformMemo: e.target.value })} placeholder="예: 9/15 계약. 구축비 입금 확인. 캐치걸 사진 아직 못 받음." />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveContract} loading={pending}>저장</Button>
            <Button size="sm" variant="ghost" onClick={() => { setF({ plan, ownerContact, platformMemo }); setOpen(false); }}>취소</Button>
          </div>
        </div>
      )}

      {open === "account" && (
        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-brand/40 bg-blush-lt/30 p-3.5">
          <div className="text-[11px] leading-[1.7] text-mute">
            업체가 관리자 화면에 들어갈 때 쓰는 계정이에요. 비밀번호를 잊었다고 하면 여기서 새로 정해 알려 주세요.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="관리자 이메일">
              <Input type="email" value={acct.email} onChange={(e) => setAcct({ ...acct, email: e.target.value })} className="h-11" />
            </Field>
            <Field label="새 비밀번호" hint="비워 두면 그대로예요">
              <Input type="text" value={acct.password} onChange={(e) => setAcct({ ...acct, password: e.target.value })} placeholder="새 비밀번호" className="h-11 font-mono" />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveAccount} loading={pending} disabled={!acct.email.trim()}>계정 저장</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAcct({ email: adminEmail, password: "" }); setOpen(false); }}>취소</Button>
          </div>
        </div>
      )}
    </div>
  );
}
