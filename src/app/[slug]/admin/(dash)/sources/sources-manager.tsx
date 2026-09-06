"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import { TIER_LABEL, type SourceTier } from "@/lib/sources";
import { deleteReferralSource, saveReferralSource } from "../../actions";

type Item = { id: string; name: string; tier: SourceTier; isActive: boolean };

/** 사이트 목록 관리 — 광고를 넣고 빼면 목록도 바뀐다 */
export function SourcesManager({ slug, items }: { slug: string; items: Item[] }) {
  const [adding, setAdding] = useState({ name: "", tier: "" as SourceTier });
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const save = (v: { id?: string; name: string; tier: SourceTier; isActive: boolean }) =>
    start(async () => {
      const r = await saveReferralSource(slug, v);
      if (!r.ok) return toast(r.error, "error");
      router.refresh();
    });

  const add = () =>
    start(async () => {
      const r = await saveReferralSource(slug, { name: adding.name, tier: adding.tier, isActive: true });
      if (!r.ok) return toast(r.error, "error");
      toast("추가했어요", "success");
      setAdding({ name: "", tier: "" });
      router.refresh();
    });

  const remove = (it: Item) =>
    start(async () => {
      if (!confirm(`'${it.name}' 을(를) 목록에서 지울까요?\n이 경로로 기록된 손님은 미기록으로 남아요.`)) return;
      const r = await deleteReferralSource(slug, it.id);
      if (!r.ok) return toast(r.error, "error");
      toast("지웠어요", "success");
      router.refresh();
    });

  return (
    <Card className="mt-4 p-5">
      <div className="text-[14px] font-bold text-ink">사이트 목록</div>
      <p className="mt-1 text-[11px] leading-[1.8] text-mute">
        신규 손님에게 물어볼 보기예요. <b className="text-ink">메이저</b>는 돈을 내고 올린 곳, <b className="text-ink">무료</b>는 그냥 등록만 한 곳이에요 —
        광고비를 낸 곳이 실제로 손님을 데려오는지 위 표에서 비교하시면 돼요.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={adding.name}
          onChange={(e) => setAdding({ ...adding, name: e.target.value })}
          placeholder="사이트 이름"
          maxLength={30}
          className="h-10 w-[180px] text-[12px]"
        />
        <Select value={adding.tier} onChange={(e) => setAdding({ ...adding, tier: e.target.value as SourceTier })} className="h-10 text-[12px]">
          <option value="">구분 없음</option>
          <option value="FREE">무료</option>
          <option value="MAJOR">메이저</option>
        </Select>
        <Button size="sm" onClick={add} loading={pending} disabled={!adding.name.trim()}>추가</Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <div
            key={it.id}
            className={cn(
              "flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-[12px]",
              it.isActive ? "border-line bg-white" : "border-line bg-[#FAF6F7] opacity-60",
            )}
          >
            <span className="font-bold text-ink">{it.name}</span>
            {it.tier && (
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", it.tier === "MAJOR" ? "bg-gold/25 text-[#8A6A20]" : "bg-[#E8F6EE] text-[#2E8B57]")}>
                {TIER_LABEL[it.tier]}
              </span>
            )}
            {!it.isActive && <Chip tone="mute">숨김</Chip>}
            <button
              onClick={() => save({ id: it.id, name: it.name, tier: it.tier, isActive: !it.isActive })}
              disabled={pending}
              className="text-[10px] font-bold text-mute underline-offset-2 hover:underline"
            >
              {it.isActive ? "숨기기" : "다시 쓰기"}
            </button>
            <button onClick={() => remove(it)} disabled={pending} className="text-[11px] font-bold text-mute hover:text-[#C0392B]">✕</button>
          </div>
        ))}
      </div>
    </Card>
  );
}
