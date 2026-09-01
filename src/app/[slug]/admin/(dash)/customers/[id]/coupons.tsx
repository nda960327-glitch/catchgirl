"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, won } from "@/lib/utils";
import { deleteCoupon, issueCoupon } from "../../../actions";

export type CouponRow = {
  id: string;
  name: string;
  amount: number;
  memo: string;
  expiresAt: string | null;
  usedAt: string | null;
  expired: boolean;
};

/** 자주 주는 쿠폰은 눌러서 채운다 — 매번 이름을 지어내지 않게 */
const PRESETS = [
  { name: "감사 쿠폰", amount: 30_000, memo: "" },
  { name: "사과 쿠폰", amount: 50_000, memo: "대기 오래 하심" },
  { name: "생일 축하 쿠폰", amount: 50_000, memo: "" },
  { name: "재방문 쿠폰", amount: 20_000, memo: "" },
];

export function Coupons({ slug, customerId, coupons }: { slug: string; customerId: string; coupons: CouponRow[] }) {
  const [form, setForm] = useState({ name: "", amount: 30_000, memo: "", validDays: 30 });
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const issue = () =>
    start(async () => {
      const r = await issueCoupon(slug, { ...form, customerId });
      if (!r.ok) return toast(r.error, "error");
      toast("쿠폰을 드렸어요", "success");
      setForm({ name: "", amount: 30_000, memo: "", validDays: 30 });
      setOpen(false);
      router.refresh();
    });

  const remove = (c: CouponRow) =>
    start(async () => {
      if (!confirm(`'${c.name}' 쿠폰을 회수할까요?`)) return;
      const r = await deleteCoupon(slug, c.id);
      if (!r.ok) return toast(r.error, "error");
      toast("회수했어요", "success");
      router.refresh();
    });

  const live = coupons.filter((c) => !c.usedAt && !c.expired);
  const done = coupons.filter((c) => c.usedAt || c.expired);

  return (
    <div className="mt-3">
      {!open && (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>+ 쿠폰 주기</Button>
      )}

      {open && (
        <div className="flex flex-col gap-3 rounded-2xl border border-brand/40 bg-blush-lt/40 p-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => setForm({ ...form, name: p.name, amount: p.amount, memo: p.memo })}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-bold text-mute hover:border-brand hover:text-brand"
              >
                {p.name} {won(p.amount)}
              </button>
            ))}
          </div>
          <Field label="쿠폰 이름" hint="손님 화면에 그대로 보여요">
            <Input value={form.name} maxLength={30} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="할인 금액" hint={won(form.amount)}>
              <Input type="number" min={1000} step={10000} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="h-11" />
            </Field>
            <Field label="사용 기한">
              <Select value={String(form.validDays)} onChange={(e) => setForm({ ...form, validDays: Number(e.target.value) })} className="w-full">
                <option value="14">14일</option>
                <option value="30">30일</option>
                <option value="60">60일</option>
                <option value="90">90일</option>
                <option value="0">기한 없음</option>
              </Select>
            </Field>
          </div>
          <Field label="발급 사유 (매장만 봐요)">
            <Textarea rows={2} maxLength={200} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <Button onClick={issue} loading={pending} className="flex-1" disabled={!form.name.trim()}>쿠폰 주기</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {coupons.length === 0 && <div className="rounded-2xl border border-dashed border-line px-4 py-4 text-center text-[11px] text-mute">아직 드린 쿠폰이 없어요</div>}
        {[...live, ...done].map((c) => (
          <div
            key={c.id}
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-[12px]",
              c.usedAt || c.expired ? "border-line bg-white opacity-70" : "border-brand/30 bg-blush-lt/40",
            )}
          >
            {c.usedAt ? <Chip tone="mute">사용함</Chip> : c.expired ? <Chip tone="mute">기한 지남</Chip> : <Chip>사용 가능</Chip>}
            <span className="font-bold text-ink">{c.name}</span>
            <span className="font-bold text-brand">{won(c.amount)}</span>
            <span className="text-[10px] text-mute">
              {c.usedAt ? `${c.usedAt} 사용` : c.expiresAt ? `${c.expiresAt}까지` : "기한 없음"}
            </span>
            {c.memo && <span className="truncate text-[10px] text-mute">· {c.memo}</span>}
            {!c.usedAt && (
              <button onClick={() => remove(c)} disabled={pending} className="ml-auto text-[11px] font-bold text-mute hover:text-[#C0392B]">회수</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
