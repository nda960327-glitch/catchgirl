"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, won } from "@/lib/utils";
import { deleteStore, markPaid, resumeStore, suspendStore, unmarkPaid } from "../actions";

export type PaymentRow = { month: string; amount: number; paid: boolean; paidAt: string | null; memo: string };

/**
 * 월별 입금. 청구 예정은 구독 시작일에서 자동으로 세어지고, 여기서는
 * 들어온 달만 눌러 표시한다. 안 눌린 달이 곧 미납이다.
 */
export function PaymentsTable({ slug, rows }: { slug: string; rows: PaymentRow[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const toggle = (r: PaymentRow) =>
    start(async () => {
      const res = r.paid ? await unmarkPaid(slug, r.month) : await markPaid(slug, r.month);
      if (!res.ok) return toast(res.error, "error");
      toast(r.paid ? `${r.month} 입금 표시를 지웠어요` : `${r.month} 입금 확인`, "success");
      router.refresh();
    });

  if (rows.length === 0) return <div className="rounded-2xl border border-dashed border-line py-6 text-center text-[12px] text-mute">아직 청구가 시작되지 않았어요</div>;

  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-card">
      {rows.map((r) => (
        <div key={r.month} className={cn("flex flex-wrap items-center gap-2 px-4 py-2.5 text-[12px]", !r.paid && "bg-bad-bg/40")}>
          <span className="w-[72px] font-bold text-ink">{r.month}</span>
          <span className="w-[80px] text-ink">{won(r.amount)}</span>
          {r.paid ? <Chip tone="green">입금 {r.paidAt}</Chip> : <Chip tone="red">미납</Chip>}
          {r.memo && <span className="text-[11px] text-mute">{r.memo}</span>}
          <button
            onClick={() => toggle(r)}
            disabled={pending}
            className={cn(
              "ml-auto rounded-lg border px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-40",
              r.paid ? "border-line bg-card text-mute hover:text-bad" : "border-ok bg-ok text-white",
            )}
          >
            {r.paid ? "표시 지우기" : "입금 확인"}
          </button>
        </div>
      ))}
    </div>
  );
}

/** 이용 정지·재개. 정지하면 손님·직원·관리자 모두 안내 화면만 본다. */
export function SuspendBox({ slug, isSuspended, reason }: { slug: string; isSuspended: boolean; reason: string }) {
  const [why, setWhy] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const suspend = () =>
    start(async () => {
      if (!confirm("이 매장의 손님·직원·관리자 화면을 모두 닫을까요? 언제든 다시 열 수 있어요.")) return;
      const r = await suspendStore(slug, why || "운영사 확인 필요");
      if (!r.ok) return toast(r.error, "error");
      toast("이용을 중지했어요", "success");
      router.refresh();
    });
  const resume = () =>
    start(async () => {
      const r = await resumeStore(slug);
      if (!r.ok) return toast(r.error, "error");
      toast("다시 열었어요", "success");
      router.refresh();
    });

  if (isSuspended) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-bad/30 bg-bad-bg px-4 py-3">
        <Chip tone="red">이용 중지</Chip>
        <span className="text-[12px] text-ink">{reason || "사유 없음"}</span>
        <Button size="sm" className="ml-auto" onClick={resume} loading={pending}>다시 열기</Button>
      </div>
    );
  }
  // 자주 쓰는 사유는 한 번에 — 약관 조항을 같이 남겨 두면 나중에 근거를 찾기 쉽다
  const PRESETS = ["약관 3항 위반 · 4항에 따라 즉시 정지", "미납 2개월 이상 (약관 6항)", "사업자 정보 불일치 (약관 2항)"];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => setWhy(p)} className="rounded-full border border-line bg-card px-2.5 py-1 text-[10px] font-bold text-mute hover:border-bad hover:text-bad">{p}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="사유 (예: 9월 미납)" maxLength={200} className="h-10 flex-1 text-[12px]" />
        <Button size="sm" variant="outline" onClick={suspend} loading={pending}>이용 중지</Button>
      </div>
    </div>
  );
}

/** 삭제 — 주소를 그대로 쳐야만 지워진다. 손님·예약·매출이 전부 함께 사라진다. */
export function DeleteBox({ slug }: { slug: string }) {
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const { toast } = useToast();

  const remove = () =>
    start(async () => {
      if (!confirm("정말 지울까요? 손님·예약·매출 기록이 모두 사라지고 되돌릴 수 없어요.")) return;
      const r = await deleteStore(slug, typed);
      if (r && !r.ok) toast(r.error, "error");
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`확인하려면 "${slug}" 입력`} className="h-10 flex-1 font-mono text-[12px]" />
      <button
        onClick={remove}
        disabled={pending || typed.trim() !== slug}
        className="rounded-xl bg-bad px-3 py-2 text-[12px] font-bold text-white disabled:opacity-30"
      >
        매장 삭제
      </button>
    </div>
  );
}
