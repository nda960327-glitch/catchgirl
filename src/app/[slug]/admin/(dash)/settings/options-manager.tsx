"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Eyebrow, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { deleteStoreOption, saveStoreOption } from "../../actions";

export type OptionItem = { id: string; name: string; price: number; isActive: boolean };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 관리자 — 예약 시 붙이는 추가 옵션의 이름과 가격을 직접 관리 */
export function OptionsManager({ slug, items }: { slug: string; items: OptionItem[] }) {
  const [rows, setRows] = useState(items);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const set = (id: string, patch: Partial<OptionItem>) => setRows((v) => v.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = (row: OptionItem) =>
    start(async () => {
      const r = await saveStoreOption(slug, row);
      toast(r.ok ? "저장했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  const add = () =>
    start(async () => {
      const r = await saveStoreOption(slug, { name: `옵션${rows.length + 1}`, price: 50000, isActive: true });
      toast(r.ok ? "옵션을 추가했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  const remove = (row: OptionItem) =>
    start(async () => {
      if (!confirm(`'${row.name}' 옵션을 삭제할까요?\n\n이미 이 옵션으로 잡힌 예약의 내역은 그대로 남아요.`)) return;
      const r = await deleteStoreOption(slug, row.id);
      toast(r.ok ? "삭제했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  return (
    <Card className="mt-5 p-5">
      <Eyebrow>Options</Eyebrow>
      <div className="mt-1 text-[14px] font-bold text-ink">추가 옵션</div>
      <p className="mt-1 text-[12px] text-mute">예약할 때 고객이 고르는 항목이에요. 여러 시간을 예약해도 <b className="text-ink">예약당 1회</b>만 부과돼요.</p>

      <div className="mt-4 flex flex-col gap-2.5">
        {rows.length === 0 && <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">아직 옵션이 없어요</div>}
        {rows.map((o) => (
          <div key={o.id} className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-line bg-card p-3">
            <Field label="이름" className="min-w-[130px] flex-1">
              <Input value={o.name} onChange={(e) => set(o.id, { name: e.target.value })} className="h-10 text-[13px]" />
            </Field>
            <Field label="추가 요금" hint={won(o.price)} className="w-[150px]">
              <Input type="number" min={0} step={10000} value={o.price} onChange={(e) => set(o.id, { price: Number(e.target.value) })} className="h-10 text-[13px]" />
            </Field>
            <label className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-mute">
              <input type="checkbox" checked={o.isActive} onChange={(e) => set(o.id, { isActive: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
              노출
            </label>
            {!o.isActive && <Chip tone="mute" className="mb-2.5">숨김</Chip>}
            <div className="mb-1 ml-auto flex gap-1.5">
              <Button size="sm" onClick={() => save(o)} loading={pending}>저장</Button>
              <button onClick={() => remove(o)} disabled={pending} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-mute hover:text-bad">삭제</button>
            </div>
          </div>
        ))}
      </div>

      <Button size="sm" variant="secondary" onClick={add} loading={pending} className="mt-3">+ 옵션 추가</Button>
    </Card>
  );
}
