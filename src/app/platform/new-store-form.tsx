"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { COMMITMENT_LABEL, PLANS, billedPrice, type Commitment } from "@/lib/plans";
import { won } from "@/lib/utils";
import { THEMES, type ThemeKey } from "@/lib/themes";
import { TERMS_VERSION, formatBizNumber } from "@/lib/terms";
import { uploadImages } from "@/lib/image-client";
import { BAR_TYPES, LICENSES, barLicenseProblem, type BarType, type LicenseType } from "@/lib/bar";
import { createStore } from "./actions";

/** 매장 이름으로 주소 후보를 만든다 — 한글은 못 쓰니 영문만 남긴다 */
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

const BLANK = {
  name: "", slug: "", adminEmail: "", adminPassword: "",
  openTime: "12:00", shiftSplitTime: "20:00", closeTime: "04:00",
  roomCount: 10, plan: "PRO" as "PRO" | "MAX", commitment: "TERM24" as Commitment, agentId: "", theme: "rose" as ThemeKey, contactPhone: "", contactTelegram: "",
  bizName: "", bizNumber: "", bizType: "", bizOwner: "", bizDocUrl: "", bizVerified: false, bizVerifyMemo: "",
  barType: "" as BarType | "", licenseType: "" as LicenseType | "", address: "", licenseDocUrl: "", venuePhotos: [] as string[],
  termsAgreed: false, termsAgreedBy: "",
};

/**
 * 새 매장 만들기.
 *
 * 여기서 만들면 관리자 계정, 룸, 옵션 틀, 등급 혜택, 사이트 목록, 안내 공지까지
 * 한 번에 생겨서 그날 바로 관리자에게 넘길 수 있다.
 */
export type AgentLite = { id: string; name: string; code: string };

export function NewStoreForm({ agents }: { agents: AgentLite[] }) {
  const [f, setF] = useState(BLANK);
  const [slugTouched, setSlugTouched] = useState(false);
  const [done, setDone] = useState<{ slug: string; email: string; password: string } | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const onDoc = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const [up] = await uploadImages([files[0]]);
      setF((x) => ({ ...x, bizDocUrl: up.url, bizVerified: false }));
    } catch (e) { toast(e instanceof Error ? e.message : "업로드에 실패했어요.", "error"); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const setName = (name: string) => setF({ ...f, name, slug: slugTouched ? f.slug : slugify(name) });

  const submit = () =>
    start(async () => {
      // 체크가 안 된 채 보내면 서버가 같은 말을 하지만, 여기서 먼저 막아 두는 게 빠르다
      if (!f.bizVerified || !f.termsAgreed) return toast("사업자 확인과 약관 동의를 먼저 체크해 주세요.", "error");
      if (!f.barType || !f.licenseType) return toast("업장 유형과 영업 허가를 골라 주세요.", "error");
      const lawErr = barLicenseProblem(f.barType, f.licenseType);
      if (lawErr) return toast(lawErr, "error");
      const r = await createStore({ ...f, barType: f.barType as BarType, licenseType: f.licenseType as LicenseType, bizVerified: true, termsAgreed: true });
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
          <Field label="요금제" hint={`${won(billedPrice(f.plan, f.commitment))}/월`}>
            <Select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as "PRO" | "MAX" })} className="w-full">
              {(Object.keys(PLANS) as ("PRO" | "MAX")[]).map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="약정" hint={f.commitment === "TERM24" ? "약정가 · 방문 세팅 무료" : "정가 · 위약금 없음"}>
            <Select value={f.commitment} onChange={(e) => setF({ ...f, commitment: e.target.value as Commitment })} className="w-full">
              {(["TERM24", "MONTHLY"] as Commitment[]).map((c) => <option key={c} value={c}>{COMMITMENT_LABEL[c]}</option>)}
            </Select>
          </Field>
          <Field label="담당직원" hint="데려온 사람 · 커미션 대상">
            <Select value={f.agentId} onChange={(e) => setF({ ...f, agentId: e.target.value })} className="w-full">
              <option value="">없음</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
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
            <Input value={f.contactTelegram} onChange={(e) => setF({ ...f, contactTelegram: e.target.value.replace(/^@/, "") })} placeholder="catch_girl_admin" className="h-11" />
          </Field>
        </div>

        {/* 사업자 확인 — 등록증 없이는 만들 수 없다 */}
        <div className="mt-2 rounded-2xl border border-gold/40 bg-gold-lt/20 p-3.5">
          <div className="text-[12px] font-bold text-ink">사업자 확인</div>
          <p className="mt-0.5 text-[10px] leading-[1.7] text-mute">
            등록증 사본을 받아 그대로 옮겨 적고, <a href="https://www.hometax.go.kr" target="_blank" rel="noreferrer" className="font-bold text-brand underline-offset-2 hover:underline">홈택스 사업자 상태 조회</a>로 계속사업자인지·업종이 맞는지 본 뒤에 체크해요.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="상호 (등록증 그대로)">
              <Input value={f.bizName} onChange={(e) => setF({ ...f, bizName: e.target.value })} maxLength={60} className="h-11" />
            </Field>
            <Field label="사업자등록번호" hint={f.bizNumber ? formatBizNumber(f.bizNumber) : "10자리"}>
              <Input value={f.bizNumber} onChange={(e) => setF({ ...f, bizNumber: e.target.value })} placeholder="000-00-00000" maxLength={12} className="h-11 font-mono" inputMode="numeric" />
            </Field>
            <Field label="업태 · 종목">
              <Input value={f.bizType} onChange={(e) => setF({ ...f, bizType: e.target.value })} placeholder="예: 음식점업 · 일반음식점" maxLength={80} className="h-11" />
            </Field>
            <Field label="대표자">
              <Input value={f.bizOwner} onChange={(e) => setF({ ...f, bizOwner: e.target.value })} maxLength={30} className="h-11" />
            </Field>
          </div>
          <Field label="영업장 주소" hint="등록증·허가증 소재지와 같아야" className="mt-3">
            <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={120} className="h-11" />
          </Field>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="업장 유형" hint="착석바는 1종만">
              <Select value={f.barType} onChange={(e) => setF({ ...f, barType: e.target.value as BarType })} className="w-full">
                <option value="">고르기</option>
                {BAR_TYPES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              </Select>
            </Field>
            <Field label="영업 허가" hint="허가증대로">
              <Select value={f.licenseType} onChange={(e) => setF({ ...f, licenseType: e.target.value as LicenseType })} className="w-full">
                <option value="">고르기</option>
                {LICENSES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </Select>
            </Field>
          </div>
          {f.barType && f.licenseType && barLicenseProblem(f.barType, f.licenseType) && <div className="mt-2 rounded-xl bg-bad-bg px-3 py-2 text-[11px] text-bad">{barLicenseProblem(f.barType, f.licenseType)}</div>}
          <div className="mt-2 text-[10px] text-mute">허가증 사본과 업장 사진은 만든 뒤 매장 페이지 '사업자 확인' 에서 올려요. 없으면 확인 완료가 안 돼요.</div>
          <Field label="사업자등록증 사본" hint="사진이나 스캔 한 장" className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              {f.bizDocUrl ? (
                <a href={f.bizDocUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.bizDocUrl} alt="사업자등록증" className="h-20 w-20 object-cover" />
                </a>
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-line text-[10px] text-mute">없음</span>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onDoc(e.target.files)} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>{f.bizDocUrl ? "다시 올리기" : "사본 올리기"}</Button>
            </div>
          </Field>
          <Field label="확인 메모" hint="조회 결과·허가 종류" className="mt-3">
            <Input value={f.bizVerifyMemo} onChange={(e) => setF({ ...f, bizVerifyMemo: e.target.value })} placeholder="예: 9/8 홈택스 계속사업자 확인, 일반음식점 영업신고" maxLength={300} className="h-11" />
          </Field>
          <label className="mt-3 flex items-start gap-2 text-[11px] font-semibold text-ink">
            <input type="checkbox" checked={f.bizVerified} onChange={(e) => setF({ ...f, bizVerified: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#B4586A]" />
            <span>등록증 사본을 받았고, 홈택스 조회로 사업자 상태와 업태·종목을 확인했어요.</span>
          </label>
        </div>

        {/* 약관 — 대표자가 읽고 동의했는지 파는 쪽이 확인한다 */}
        <div className="rounded-2xl border border-line bg-card p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[12px] font-bold text-ink">이용 약관 동의</div>
            <Link href="/platform/terms" target="_blank" className="text-[11px] font-bold text-brand underline-offset-2 hover:underline">약관 전문 보기 ({TERMS_VERSION} 판) ↗</Link>
          </div>
          <p className="mt-0.5 text-[10px] leading-[1.7] text-mute">
            성매매 알선 등 금지 행위가 확인되면 사전 통지 없이 즉시 정지되고 환불이 없다는 조항이 들어 있어요. 대표자에게 전문을 보여 주고 동의를 받으세요.
          </p>
          <Field label="동의한 사람" hint="대표자 이름 또는 연락처" className="mt-3">
            <Input value={f.termsAgreedBy} onChange={(e) => setF({ ...f, termsAgreedBy: e.target.value })} maxLength={60} className="h-11" />
          </Field>
          <label className="mt-3 flex items-start gap-2 text-[11px] font-semibold text-ink">
            <input type="checkbox" checked={f.termsAgreed} onChange={(e) => setF({ ...f, termsAgreed: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#B4586A]" />
            <span>대표자가 약관 {TERMS_VERSION} 판을 읽고 동의했음을 확인했어요.</span>
          </label>
        </div>

        <Button
          onClick={submit}
          loading={pending}
          disabled={!f.name || !f.slug || !f.adminEmail || !f.adminPassword || !f.bizName || !f.bizNumber || !f.bizType || !f.bizOwner || !f.bizDocUrl || !f.barType || !f.licenseType || !f.address || !f.bizVerified || !f.termsAgreed || !f.termsAgreedBy}
        >
          매장 만들기
        </Button>
      </div>
    </Card>
  );
}
