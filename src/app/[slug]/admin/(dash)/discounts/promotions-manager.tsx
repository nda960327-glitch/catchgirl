"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, won } from "@/lib/utils";
import { deleteDayPromotion, saveDayPromotion } from "../../actions";

type Promo = { id: string; name: string; amount: number; startDate: string; endDate: string; isActive: boolean };

/** 오늘 하루만 거는 할인을 자주 쓰므로 바로 쓸 수 있는 문구를 준비해 둔다 */
const PRESETS = [
  { name: "비 오는 날 할인", amount: 30_000 },
  { name: "평일 낮 할인", amount: 20_000 },
  { name: "오픈 기념 할인", amount: 50_000 },
];

export function PromotionsManager({ slug, today, items }: { slug: string; today: string; items: Promo[] }) {
  const blank = { id: "", name: "", amount: 30_000, startDate: today, endDate: today, isActive: true };
  const [form, setForm] = useState<Promo>(blank);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const save = () =>
    start(async () => {
      const r = await saveDayPromotion(slug, { ...form, id: form.id || undefined });
      if (!r.ok) return toast(r.error, "error");
      toast("저장했어요", "success");
      setForm(blank);
      setOpen(false);
      router.refresh();
    });

  const remove = (p: Promo) =>
    start(async () => {
      if (!confirm(`'${p.name}' 할인을 지울까요?`)) return;
      const r = await deleteDayPromotion(slug, p.id);
      if (!r.ok) return toast(r.error, "error");
      toast("지웠어요", "success");
      router.refresh();
    });

  const running = (p: Promo) => p.isActive && p.startDate <= today && p.endDate >= today;

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[14px] font-bold text-ink">기간 할인</div>
          <p className="mt-1 text-[11px] text-mute">비 오는 날처럼 그날만 거는 할인이에요. 그 기간에 시작하는 예약에 자동으로 붙어요.</p>
        </div>
        {!open && <Button size="sm" variant="secondary" onClick={() => { setForm(blank); setOpen(true); }}>+ 할인 걸기</Button>}
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand/40 bg-blush-lt/40 p-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => setForm({ ...form, name: p.name, amount: p.amount })}
                className="rounded-full border border-line bg-card px-3 py-1.5 text-[11px] font-bold text-mute hover:border-brand hover:text-brand"
              >
                {p.name} {won(p.amount)}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="할인 이름" hint="손님 화면에 그대로 보여요">
              <Input value={form.name} maxLength={30} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" />
            </Field>
            <Field label="할인 금액" hint={won(form.amount)}>
              <Input type="number" min={1000} step={10000} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="h-11" />
            </Field>
            <Field label="시작일">
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-11" />
            </Field>
            <Field label="종료일" hint="하루만 하려면 시작일과 같게">
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-11" />
            </Field>
          </div>
          <label className="flex items-center gap-1.5 text-[12px] font-semibold text-mute">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
            바로 적용
          </label>
          <div className="flex gap-2">
            <Button onClick={save} loading={pending} className="flex-1" disabled={!form.name.trim()}>저장</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {items.length === 0 && <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">걸어 둔 할인이 없어요</div>}
        {items.map((p) => (
          <div key={p.id} className={cn("flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-3", running(p) ? "border-brand/40 bg-blush-lt/40" : "border-line bg-card")}>
            {running(p) ? <Chip>진행 중</Chip> : !p.isActive ? <Chip tone="mute">꺼짐</Chip> : <Chip tone="mute">대기</Chip>}
            <span className="text-[13px] font-bold text-ink">{p.name}</span>
            <span className="text-[13px] font-bold text-brand">{won(p.amount)}</span>
            <span className="text-[11px] text-mute">
              {p.startDate === p.endDate ? p.startDate : `${p.startDate} ~ ${p.endDate}`}
            </span>
            <div className="ml-auto flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => { setForm(p); setOpen(true); }}>수정</Button>
              <button onClick={() => remove(p)} disabled={pending} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-mute hover:text-bad">삭제</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
