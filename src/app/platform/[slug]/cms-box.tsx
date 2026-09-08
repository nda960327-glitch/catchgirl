"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { DEBIT_DAY } from "@/lib/plans";
import { updateCms } from "../actions";

/**
 * CMS 자동이체 등록 상태.
 *
 * 출금 동의는 CMS 사(효성·나이스 등)가 보내는 링크·QR·ARS 로 받고, 여기엔 그 결과만 적는다:
 * CMS 사 회원번호(청구 파일의 키)와 동의받은 날. 회원번호가 없으면 청구 명단에 안 실린다.
 */
export function CmsBox({ slug, memberNo, agreedAt, note }: { slug: string; memberNo: string; agreedAt: string | null; note: string }) {
  const [edit, setEdit] = useState(!memberNo);
  const [f, setF] = useState({ memberNo, agreed: !!agreedAt, note });
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const save = () =>
    start(async () => {
      const r = await updateCms(slug, f);
      if (!r.ok) return toast(r.error, "error");
      toast("저장했어요", "success");
      setEdit(false);
      router.refresh();
    });

  return (
    <div className="mt-3 rounded-2xl border border-line bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {memberNo && agreedAt ? <Chip tone="green">자동이체 등록 · {agreedAt} 동의</Chip> : memberNo ? <Chip tone="gold">회원번호만 있음 · 동의 확인 필요</Chip> : <Chip tone="red">자동이체 미등록</Chip>}
        <span className="text-[11px] text-mute">매월 {DEBIT_DAY}일 출금</span>
        <button onClick={() => setEdit(!edit)} className="ml-auto rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-ink hover:border-brand">{edit ? "닫기" : "수정"}</button>
      </div>
      {!edit ? (
        <dl className="mt-3 grid grid-cols-[88px_1fr] gap-x-2 gap-y-1 text-[12px]">
          <dt className="text-mute">CMS 회원번호</dt><dd className="font-mono text-ink">{memberNo || "—"}</dd>
          <dt className="text-mute">메모</dt><dd className="text-ink">{note || "—"}</dd>
        </dl>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="text-[11px] leading-[1.7] text-mute">
            CMS 사 관리자 화면에서 이 매장을 고객으로 등록하고 출금 동의 링크를 대표자에게 보내세요. 동의가 끝나면 거기 회원번호를 여기에 적어요. 그때부터 청구 명단에 실려요.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="CMS 회원번호" hint="청구 파일에 들어가는 번호">
              <Input value={f.memberNo} onChange={(e) => setF({ ...f, memberNo: e.target.value })} maxLength={40} className="h-10 font-mono text-[12px]" />
            </Field>
            <Field label="메모" hint="은행·예금주 앞자리 등">
              <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={120} className="h-10 text-[12px]" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-ink">
            <input type="checkbox" checked={f.agreed} onChange={(e) => setF({ ...f, agreed: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
            출금 동의를 받았어요 (링크·QR·ARS)
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={pending}>저장</Button>
            <Button size="sm" variant="ghost" onClick={() => { setF({ memberNo, agreed: !!agreedAt, note }); setEdit(false); }}>취소</Button>
          </div>
        </div>
      )}
    </div>
  );
}
