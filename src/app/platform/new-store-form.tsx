"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { PLANS, billedPrice } from "@/lib/plans";
import { won } from "@/lib/utils";
import { THEMES, type ThemeKey } from "@/lib/themes";
import { createStore } from "./actions";

/** 매장 이름으로 주소 후보를 만든다 — 한글은 못 쓰니 영문만 남긴다 */
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

const BLANK = {
  name: "", slug: "", adminEmail: "", adminPassword: "",
  openTime: "12:00", shiftSplitTime: "20:00", closeTime: "04:00",
  roomCount: 10, plan: "PRO" as "PRO" | "MAX", theme: "rose" as ThemeKey, contactPhone: "", contactTelegram: "",
};

/**
 * 새 매장 만들기.
 *
 * 여기서 만들면 관리자 계정, 룸, 옵션 틀, 등급 혜택, 사이트 목록, 안내 공지까지
 * 한 번에 생겨서 그날 바로 관리자에게 넘길 수 있다.
 */
export function NewStoreForm() {
  const [f, setF] = useState(BLANK);
  const [slugTouched, setSlugTouched] = useState(false);
  const [done, setDone] = useState<{ slug: string; email: string; password: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const setName = (name: string) => setF({ ...f, name, slug: slugTouched ? f.slug : slugify(name) });

  const submit = () =>
    start(async () => {
      const r = await createStore(f);
      if (!r.ok) return toast(r.error, "error");
      setDone({ slug: r.data!.slug, email: f.adminEmail, password: f.adminPassword });
      setF(BLANK);
      setSlugTouched(false);
      router.refresh();
    });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Card className="p-5">
      <div className="text-[14px] font-bold text-ink">새 매장 만들기</div>
      <p className="mt-1 text-[11px] leading-[1.7] text-mute">
        관리자 계정 · 룸 · 옵션 틀 · 등급 혜택 · 사이트 목록 · 안내 공지가 같이 생겨요. 만들자마자 관리자에게 넘기면 돼요.
      </p>

      {done && (
        <div className="mt-4 rounded-2xl border border-ok/30 bg-ok-bg p-4 text-[12px] leading-[1.9]">
          <div className="font-bold text-ok">매장을 만들었어요. 관리자에게 이대로 전달하세요.</div>
          <div className="mt-2 rounded-xl bg-card px-3 py-2 font-mono text-[11px] text-ink">
            관리자 주소  {origin}/{done.slug}/admin<br />
            이메일      {done.email}<br />
            비밀번호    {done.password}<br />
            손님 주소   {origin}/{done.slug}
          </div>
          <div className="mt-1.5 text-[10px] text-mute">비밀번호는 여기서만 보여요. 관리자가 들어가서 바꾸게 해 주세요.</div>
          <button onClick={() => setDone(null)} className="mt-2 text-[11px] font-bold text-mute underline-offset-2 hover:underline">닫기</button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <Field label="매장 이름">
          <Input value={f.name} onChange={(e) => setName(e.target.value)} placeholder="예: 문라이트" maxLength={30} className="h-11" />
        </Field>
        <Field label="주소 (영문)" hint={f.slug ? `${origin}/${f.slug}` : "손님·관리자가 들어오는 주소예요"}>
          <Input
            value={f.slug}
            onChange={(e) => { setSlugTouched(true); setF({ ...f, slug: e.target.value.toLowerCase() }); }}
            placeholder="moonlight"
            maxLength={30}
            className="h-11 font-mono"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="관리자 이메일">
            <Input type="email" value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })} placeholder="owner@example.com" className="h-11" />
          </Field>
          <Field label="관리자 비밀번호">
            <Input type="text" value={f.adminPassword} onChange={(e) => setF({ ...f, adminPassword: e.target.value })} placeholder="처음 비밀번호" className="h-11 font-mono" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="오픈"><Input type="time" value={f.openTime} onChange={(e) => setF({ ...f, openTime: e.target.value })} className="h-11" /></Field>
          <Field label="교대"><Input type="time" value={f.shiftSplitTime} onChange={(e) => setF({ ...f, shiftSplitTime: e.target.value })} className="h-11" /></Field>
          <Field label="마감"><Input type="time" value={f.closeTime} onChange={(e) => setF({ ...f, closeTime: e.target.value })} className="h-11" /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="룸 개수" hint="이름은 나중에 바꿀 수 있어요">
            <Input type="number" min={1} max={50} value={f.roomCount} onChange={(e) => setF({ ...f, roomCount: Number(e.target.value) })} className="h-11" />
          </Field>
          <Field label="요금제" hint={`${won(billedPrice(f.plan))}/월`}>
            <Select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as "PRO" | "MAX" })} className="w-full">
              {(Object.keys(PLANS) as ("PRO" | "MAX")[]).map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="화면 테마" hint={THEMES[f.theme].desc}>
          <Select value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value as ThemeKey })} className="w-full">
            {(Object.keys(THEMES) as ThemeKey[]).map((k) => <option key={k} value={k}>{THEMES[k].name}{THEMES[k].dark ? " (어두움)" : ""}</option>)}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="문의 전화" hint="선택">
            <Input value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} placeholder="010-0000-0000" className="h-11" />
          </Field>
          <Field label="텔레그램" hint="@ 없이">
            <Input value={f.contactTelegram} onChange={(e) => setF({ ...f, contactTelegram: e.target.value.replace(/^@/, "") })} placeholder="BGT_OP" className="h-11" />
          </Field>
        </div>

        <Button onClick={submit} loading={pending} disabled={!f.name || !f.slug || !f.adminEmail || !f.adminPassword}>
          매장 만들기
        </Button>
      </div>
    </Card>
  );
}
