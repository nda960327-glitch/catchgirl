"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { resizeImage } from "@/lib/image-client";
import { PLANS, billedPrice } from "@/lib/plans";
import { THEMES, type ThemeKey } from "@/lib/themes";
import { OPERATOR_CONTACT, TERMS, TERMS_VERSION, formatBizNumber } from "@/lib/terms";
import { won } from "@/lib/utils";
import { signupStore } from "./actions";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

const BLANK = {
  name: "", slug: "", adminEmail: "", adminPassword: "", adminPassword2: "",
  plan: "PRO" as "PRO" | "MAX", theme: "rose" as ThemeKey,
  openTime: "12:00", shiftSplitTime: "20:00", closeTime: "04:00", roomCount: 10,
  contactPhone: "", contactTelegram: "", ownerContact: "",
  bizName: "", bizNumber: "", bizType: "", bizOwner: "",
  termsAgreed: false, termsAgreedBy: "", website: "",
};

/** 등록증 사본은 신청서와 함께 보낸다 — 세션이 없어 업로드 API 를 쓸 수 없다 */
type Doc = { full: string; thumb: string } | null;

export function SignupForm() {
  const [f, setF] = useState(BLANK);
  const [doc, setDoc] = useState<Doc>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [done, setDone] = useState<{ slug: string; email: string } | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const setName = (name: string) => setF({ ...f, name, slug: slugTouched ? f.slug : slugify(name) });

  const onDoc = async (files: FileList | null) => {
    if (!files?.length) return;
    setPreparing(true);
    try {
      const [full, thumb] = await Promise.all([resizeImage(files[0], 1600), resizeImage(files[0], 320, 0.8, 400_000)]);
      setDoc({ full, thumb });
    } catch (e) { toast(e instanceof Error ? e.message : "이미지를 읽지 못했어요.", "error"); } finally { setPreparing(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const ready =
    f.name && f.slug && f.adminEmail && f.adminPassword.length >= 6 && f.adminPassword === f.adminPassword2 &&
    f.ownerContact && f.bizName && f.bizNumber && f.bizType && f.bizOwner && !!doc && f.termsAgreed && f.termsAgreedBy;

  const submit = () =>
    start(async () => {
      if (f.adminPassword !== f.adminPassword2) return toast("비밀번호 두 칸이 서로 달라요.", "error");
      if (!doc) return toast("사업자등록증 사본을 올려 주세요.", "error");
      if (!f.termsAgreed) return toast("약관에 동의해 주세요.", "error");
      const { adminPassword2: _drop, ...rest } = f;
      void _drop;
      const r = await signupStore({ ...rest, termsAgreed: true, bizDoc: doc });
      if (!r.ok) return toast(r.error, "error");
      setDone({ slug: r.data!.slug, email: f.adminEmail });
      window.scrollTo({ top: 0 });
    });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (done) {
    return (
      <div className="rounded-[24px] bg-card p-6 shadow-card">
        <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Received</div>
        <h2 className="mt-1 font-serif text-[20px] font-bold text-ink">신청서를 받았어요</h2>
        <p className="mt-2 text-[12px] leading-[1.9] text-mute">
          운영사가 사업자등록증과 업종을 확인한 뒤 <b className="text-ink">{f.ownerContact || "적어 주신 연락처"}</b>로 연락드려요. 보통 영업일 하루 안이에요.
          승인되면 아래 주소가 바로 열리고, 요금 자동이체(매월 5일) 출금 동의 링크를 같이 보내드려요. 그 전에는 "확인 중" 안내만 보여요.
        </p>
        <div className="mt-4 rounded-xl bg-well px-3 py-2.5 font-mono text-[11px] leading-[1.9] text-ink">
          관리자 주소  {origin}/{done.slug}/admin<br />
          이메일      {done.email}<br />
          손님 주소   {origin}/{done.slug}
        </div>
        <div className="mt-3 text-[11px] leading-[1.8] text-mute">
          비밀번호는 방금 정하신 것 그대로예요. 급하면 텔레그램 <a href={`https://t.me/${OPERATOR_CONTACT.telegram}`} target="_blank" rel="noreferrer" className="font-bold text-brand">@{OPERATOR_CONTACT.telegram}</a>로 알려 주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 매장 */}
      <section className="rounded-[24px] bg-card p-5 shadow-card">
        <div className="text-[13px] font-bold text-ink">매장</div>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="매장 이름">
            <Input value={f.name} onChange={(e) => setName(e.target.value)} placeholder="예: 문라이트" maxLength={30} className="h-11" />
          </Field>
          <Field label="주소 (영문)" hint={f.slug ? `${origin}/${f.slug}` : "손님·직원·관리자가 들어오는 주소예요"}>
            <Input value={f.slug} onChange={(e) => { setSlugTouched(true); setF({ ...f, slug: e.target.value.toLowerCase() }); }} placeholder="moonlight" maxLength={30} className="h-11 font-mono" />
          </Field>
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
            <Field label="손님 문의 전화" hint="선택 · 손님 화면에 보여요">
              <Input value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} placeholder="010-0000-0000" className="h-11" />
            </Field>
            <Field label="손님 문의 텔레그램" hint="선택 · @ 없이">
              <Input value={f.contactTelegram} onChange={(e) => setF({ ...f, contactTelegram: e.target.value.replace(/^@/, "") })} placeholder="mystore" className="h-11" />
            </Field>
          </div>
        </div>
      </section>

      {/* 관리자 계정 */}
      <section className="rounded-[24px] bg-card p-5 shadow-card">
        <div className="text-[13px] font-bold text-ink">관리자 계정</div>
        <div className="mt-0.5 text-[11px] text-mute">매장 관리자 화면에 들어갈 때 써요. 승인되면 이 계정으로 바로 들어갈 수 있어요.</div>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="이메일">
            <Input type="email" value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })} placeholder="owner@example.com" className="h-11" autoComplete="email" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="비밀번호" hint="6자 이상">
              <Input type="password" value={f.adminPassword} onChange={(e) => setF({ ...f, adminPassword: e.target.value })} className="h-11" autoComplete="new-password" />
            </Field>
            <Field label="비밀번호 확인" hint={f.adminPassword2 && f.adminPassword !== f.adminPassword2 ? "서로 달라요" : ""}>
              <Input type="password" value={f.adminPassword2} onChange={(e) => setF({ ...f, adminPassword2: e.target.value })} className="h-11" autoComplete="new-password" />
            </Field>
          </div>
          <Field label="연락받을 전화 또는 텔레그램" hint="운영사가 확인 결과를 알려드릴 곳 · 손님에게는 안 보여요">
            <Input value={f.ownerContact} onChange={(e) => setF({ ...f, ownerContact: e.target.value })} placeholder="010-0000-0000 또는 @telegram" maxLength={120} className="h-11" />
          </Field>
        </div>
      </section>

      {/* 사업자 */}
      <section className="rounded-[24px] border border-gold/40 bg-card p-5 shadow-card">
        <div className="text-[13px] font-bold text-ink">사업자 확인</div>
        <div className="mt-0.5 text-[11px] leading-[1.7] text-mute">사업자등록증에 적힌 그대로 옮겨 적고 사본을 올려 주세요. 운영사가 국세청 조회로 등록 상태와 업종을 확인해요.</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="상호"><Input value={f.bizName} onChange={(e) => setF({ ...f, bizName: e.target.value })} maxLength={60} className="h-11" /></Field>
          <Field label="사업자등록번호" hint={f.bizNumber ? formatBizNumber(f.bizNumber) : "10자리"}>
            <Input value={f.bizNumber} onChange={(e) => setF({ ...f, bizNumber: e.target.value })} placeholder="000-00-00000" maxLength={12} className="h-11 font-mono" inputMode="numeric" />
          </Field>
          <Field label="업태 · 종목"><Input value={f.bizType} onChange={(e) => setF({ ...f, bizType: e.target.value })} placeholder="예: 음식점업 · 일반음식점" maxLength={80} className="h-11" /></Field>
          <Field label="대표자"><Input value={f.bizOwner} onChange={(e) => setF({ ...f, bizOwner: e.target.value })} maxLength={30} className="h-11" /></Field>
        </div>
        <Field label="사업자등록증 사본" hint="사진이나 스캔 한 장" className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            {doc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={doc.thumb} alt="사업자등록증" className="h-20 w-20 rounded-xl border border-line object-cover" />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-line text-[10px] text-mute">없음</span>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onDoc(e.target.files)} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} loading={preparing}>{doc ? "다시 올리기" : "사본 올리기"}</Button>
          </div>
        </Field>
      </section>

      {/* 약관 */}
      <section className="rounded-[24px] bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[13px] font-bold text-ink">이용 약관 ({TERMS_VERSION} 판)</div>
          <Link href="/platform/terms" target="_blank" className="text-[11px] font-bold text-brand underline-offset-2 hover:underline">새 창에서 보기 ↗</Link>
        </div>
        <div className="mt-2 rounded-2xl border border-bad/30 bg-bad-bg px-4 py-3 text-[11px] leading-[1.8] text-ink">
          성매매 알선·권유·강요, 청소년 고용·출입, 성적 서비스의 광고·요청 처리 등 금지 행위가 확인되면 사전 통지 없이 즉시 이용이 정지되고, 낸 요금과 초기 구축비는 돌려드리지 않아요.
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-bold text-mute">전문 펼치기</summary>
          <div className="mt-2 flex flex-col gap-3">
            {TERMS.map((t) => (
              <div key={t.title}>
                <div className="text-[11px] font-bold text-ink">{t.title}</div>
                <p className="mt-0.5 whitespace-pre-line text-[10px] leading-[1.8] text-mute">{t.body}</p>
              </div>
            ))}
          </div>
        </details>
        <Field label="동의하는 분 (대표자)" className="mt-3">
          <Input value={f.termsAgreedBy} onChange={(e) => setF({ ...f, termsAgreedBy: e.target.value })} maxLength={60} className="h-11" />
        </Field>
        <label className="mt-3 flex items-start gap-2 text-[12px] font-semibold text-ink">
          <input type="checkbox" checked={f.termsAgreed} onChange={(e) => setF({ ...f, termsAgreed: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#B4586A]" />
          <span>약관을 읽었고 동의해요. 사업자 정보가 사실과 다르면 승인이 취소될 수 있다는 것도 알아요.</span>
        </label>
        {/* 봇용 미끼 — 사람 눈에는 안 보인다 */}
        <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
      </section>

      <Button onClick={submit} loading={pending} disabled={!ready}>가입 신청하기</Button>
      <div className="text-center text-[10px] text-mute">신청 뒤 운영사 확인을 거쳐 승인돼요. 승인 전에는 매장 화면이 열리지 않아요.</div>
    </div>
  );
}
