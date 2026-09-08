"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Chip, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { uploadImages } from "@/lib/image-client";
import { TERMS_VERSION, formatBizNumber } from "@/lib/terms";
import { recordTermsAgreement, unverifyBiz, updateBizInfo, verifyBiz } from "../actions";

export type BizInfo = { bizName: string; bizNumber: string; bizType: string; bizOwner: string; bizDocUrl: string; bizVerifyMemo: string };

/**
 * 업체 한 곳의 사업자 확인과 약관 동의 기록.
 *
 * 등록증 내용은 고칠 수 있지만, 상호·번호·업종을 고치면 확인 표시가 풀린다.
 * 다시 홈택스에서 보고 "확인 완료" 를 눌러야 한다. 약관은 새 판이 나오면
 * 여기서 다시 동의를 받아 적는다.
 */
export function BizBox({
  slug, biz, verifiedAt, terms,
}: {
  slug: string;
  biz: BizInfo;
  verifiedAt: string | null;
  terms: { version: string; agreedAt: string | null; agreedBy: string };
}) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(biz);
  const [memo, setMemo] = useState("");
  const [agreedBy, setAgreedBy] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const outdated = !!terms.agreedAt && terms.version !== TERMS_VERSION;

  const onDoc = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const [up] = await uploadImages([files[0]]);
      setF((x) => ({ ...x, bizDocUrl: up.url }));
    } catch (e) { toast(e instanceof Error ? e.message : "업로드에 실패했어요.", "error"); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const save = () =>
    start(async () => {
      const r = await updateBizInfo(slug, f);
      if (!r.ok) return toast(r.error, "error");
      toast("저장했어요", "success");
      setEdit(false);
      router.refresh();
    });
  const verify = () =>
    start(async () => {
      const r = await verifyBiz(slug, memo);
      if (!r.ok) return toast(r.error, "error");
      toast("사업자 확인을 표시했어요", "success");
      setMemo("");
      router.refresh();
    });
  const unverify = () =>
    start(async () => {
      const why = prompt("확인을 취소하는 이유를 적어 주세요 (기록에 남아요)");
      if (why === null) return;
      const r = await unverifyBiz(slug, why);
      if (!r.ok) return toast(r.error, "error");
      toast("확인을 취소했어요", "success");
      router.refresh();
    });
  const agree = () =>
    start(async () => {
      const r = await recordTermsAgreement(slug, agreedBy);
      if (!r.ok) return toast(r.error, "error");
      toast("약관 동의를 기록했어요", "success");
      setAgreedBy("");
      router.refresh();
    });

  return (
    <div className="mt-3 grid gap-4 md:grid-cols-[1fr_260px]">
      {/* 등록증 */}
      <div className="rounded-2xl border border-line bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {verifiedAt ? <Chip tone="green">확인 완료 · {verifiedAt}</Chip> : <Chip tone="red">사업자 미확인</Chip>}
          <div className="ml-auto flex gap-1.5">
            <button onClick={() => { setF(biz); setEdit(!edit); }} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-ink hover:border-brand">{edit ? "닫기" : "등록증 내용 수정"}</button>
            {verifiedAt && <button onClick={unverify} disabled={pending} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-mute hover:text-bad">확인 취소</button>}
          </div>
        </div>

        {!edit ? (
          <div className="mt-3 flex gap-3">
            {biz.bizDocUrl ? (
              <a href={biz.bizDocUrl} target="_blank" rel="noreferrer" className="block shrink-0 overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={biz.bizDocUrl} alt="사업자등록증" className="h-24 w-24 object-cover" />
              </a>
            ) : (
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-bad/40 text-center text-[10px] text-bad">사본<br />없음</span>
            )}
            <dl className="grid flex-1 grid-cols-[64px_1fr] gap-x-2 gap-y-1 text-[12px]">
              <dt className="text-mute">상호</dt><dd className="font-semibold text-ink">{biz.bizName || "—"}</dd>
              <dt className="text-mute">등록번호</dt><dd className="font-mono text-ink">{biz.bizNumber || "—"}</dd>
              <dt className="text-mute">업태·종목</dt><dd className="text-ink">{biz.bizType || "—"}</dd>
              <dt className="text-mute">대표자</dt><dd className="text-ink">{biz.bizOwner || "—"}</dd>
              {biz.bizVerifyMemo && (<><dt className="text-mute">확인 메모</dt><dd className="text-ink">{biz.bizVerifyMemo}</dd></>)}
            </dl>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="상호"><Input value={f.bizName} onChange={(e) => setF({ ...f, bizName: e.target.value })} maxLength={60} className="h-10 text-[12px]" /></Field>
              <Field label="사업자등록번호" hint={f.bizNumber ? formatBizNumber(f.bizNumber) : ""}><Input value={f.bizNumber} onChange={(e) => setF({ ...f, bizNumber: e.target.value })} maxLength={12} className="h-10 font-mono text-[12px]" inputMode="numeric" /></Field>
              <Field label="업태 · 종목"><Input value={f.bizType} onChange={(e) => setF({ ...f, bizType: e.target.value })} maxLength={80} className="h-10 text-[12px]" /></Field>
              <Field label="대표자"><Input value={f.bizOwner} onChange={(e) => setF({ ...f, bizOwner: e.target.value })} maxLength={30} className="h-10 text-[12px]" /></Field>
            </div>
            <Field label="확인 메모"><Input value={f.bizVerifyMemo} onChange={(e) => setF({ ...f, bizVerifyMemo: e.target.value })} maxLength={300} className="h-10 text-[12px]" /></Field>
            <div className="flex flex-wrap items-center gap-2">
              {f.bizDocUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.bizDocUrl} alt="" className="h-14 w-14 rounded-lg border border-line object-cover" />
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onDoc(e.target.files)} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>{f.bizDocUrl ? "사본 다시 올리기" : "사본 올리기"}</Button>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" onClick={save} loading={pending}>저장</Button>
                <Button size="sm" variant="ghost" onClick={() => { setF(biz); setEdit(false); }}>취소</Button>
              </div>
            </div>
          </div>
        )}

        {!verifiedAt && !edit && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-well p-2.5">
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="조회 결과 (예: 계속사업자 · 일반음식점 신고)" maxLength={300} className="h-10 flex-1 text-[12px]" />
            <Button size="sm" onClick={verify} loading={pending}>홈택스 조회 후 확인 완료</Button>
          </div>
        )}
      </div>

      {/* 약관 */}
      <div className="rounded-2xl border border-line bg-card p-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-ink">약관 동의</span>
          <Link href="/platform/terms" target="_blank" className="ml-auto text-[11px] font-bold text-brand underline-offset-2 hover:underline">전문 ↗</Link>
        </div>
        {terms.agreedAt ? (
          <div className="mt-2 text-[12px] leading-[1.8] text-ink">
            <b>{terms.version}</b> 판 · {terms.agreedAt}
            <br />
            <span className="text-mute">{terms.agreedBy || "동의자 미기재"}</span>
            {outdated && <div className="mt-1.5"><Chip tone="gold">새 판 {TERMS_VERSION} 동의 필요</Chip></div>}
          </div>
        ) : (
          <div className="mt-2"><Chip tone="red">동의 기록 없음</Chip></div>
        )}
        {(!terms.agreedAt || outdated) && (
          <div className="mt-3 flex flex-col gap-2">
            <Input value={agreedBy} onChange={(e) => setAgreedBy(e.target.value)} placeholder="동의한 사람 (대표자)" maxLength={60} className="h-10 text-[12px]" />
            <Button size="sm" variant="outline" onClick={agree} loading={pending} disabled={!agreedBy.trim()}>{TERMS_VERSION} 판 동의 기록</Button>
          </div>
        )}
      </div>
    </div>
  );
}
