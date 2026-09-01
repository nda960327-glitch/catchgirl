"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, won } from "@/lib/utils";
import { saveGradeBenefit } from "../../actions";

type Benefit = { grade: string; amount: number; note: string; isActive: boolean; saved: boolean };

/** 단골·VIP 가 예약할 때마다 자동으로 붙는 혜택 */
export function BenefitsForm({ slug, benefits }: { slug: string; benefits: Benefit[] }) {
  const [rows, setRows] = useState(benefits);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const set = (grade: string, patch: Partial<Benefit>) =>
    setRows(rows.map((r) => (r.grade === grade ? { ...r, ...patch } : r)));

  const save = (r: Benefit) =>
    start(async () => {
      const res = await saveGradeBenefit(slug, { grade: r.grade as "단골" | "VIP", amount: r.amount, note: r.note, isActive: r.isActive });
      if (!res.ok) return toast(res.error, "error");
      toast(`${r.grade} 혜택을 저장했어요`, "success");
      router.refresh();
    });

  return (
    <Card className="mt-4 p-5">
      <div className="text-[14px] font-bold text-ink">등급 혜택</div>
      <p className="mt-1 text-[11px] leading-[1.8] text-mute">
        방문 완료 5회부터 단골, 10회부터 VIP 예요. 예약할 때마다 자동으로 붙고, 손님 화면에도 이유가 보여요.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.grade} className={cn("rounded-2xl border p-4", r.isActive ? "border-brand/30 bg-blush-lt/40" : "border-line bg-white")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-[16px] font-bold text-ink">{r.grade}</span>
              {!r.saved && <Chip tone="mute">권장값</Chip>}
              {!r.isActive && <Chip tone="mute">꺼짐</Chip>}
              <label className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-mute">
                <input
                  type="checkbox"
                  checked={r.isActive}
                  onChange={(e) => set(r.grade, { isActive: e.target.checked })}
                  className="h-4 w-4 accent-[#B4586A]"
                />
                사용
              </label>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <Field label="예약 1건당 할인" hint={r.amount > 0 ? won(r.amount) : "0원이면 혜택이 붙지 않아요"}>
                <Input
                  type="number"
                  min={0}
                  step={10000}
                  value={r.amount}
                  onChange={(e) => set(r.grade, { amount: Number(e.target.value) })}
                  className="h-11"
                />
              </Field>
              <Field label="손님에게 보일 설명">
                <Textarea rows={2} maxLength={200} value={r.note} onChange={(e) => set(r.grade, { note: e.target.value })} />
              </Field>
            </div>

            <Button size="sm" className="mt-3" loading={pending} onClick={() => save(r)}>저장</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
