"use client";

import { useState } from "react";
import { COMMISSION } from "@/lib/plans";
import { won } from "@/lib/utils";

/** 한 달에 매장 몇 곳 소개하면 얼마인지 — 부업으로 눌러 보는 계산기 */
export function AgentEarningsCalculator() {
  const [pro, setPro] = useState(3);
  const [max, setMax] = useState(1);
  const [onsite, setOnsite] = useState(2);

  const onsiteN = Math.min(onsite, pro + max);
  const monthly = pro * COMMISSION.PRO + max * COMMISSION.MAX + onsiteN * COMMISSION.ONSITE;

  const Row = ({ label, value, set, max: mx, suffix, hint }: { label: string; value: number; set: (n: number) => void; max: number; suffix: string; hint: string }) => (
    <label className="block">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="font-semibold text-ink">{label} <span className="font-normal text-mute">· {hint}</span></span>
        <span className="font-mono font-bold text-brand">{value}{suffix}</span>
      </div>
      <input type="range" min={0} max={mx} step={1} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-1.5 w-full accent-[#B4586A]" />
    </label>
  );

  return (
    <div className="grid gap-5 rounded-[26px] bg-card p-6 shadow-card md:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="text-[13px] font-bold text-ink">한 달에 몇 곳 소개할 수 있어요?</div>
        <Row label="Pro 매장" value={pro} set={setPro} max={20} suffix="곳" hint={`한 곳 ${won(COMMISSION.PRO)}`} />
        <Row label="Max 매장" value={max} set={setMax} max={10} suffix="곳" hint={`한 곳 ${won(COMMISSION.MAX)}`} />
        <Row label="방문 세팅까지 직접" value={onsite} set={setOnsite} max={30} suffix="곳" hint={`한 곳 +${won(COMMISSION.ONSITE)} · 하루 반나절`} />
        <div className="text-[10px] leading-[1.7] text-mute">2년 약정 기준이에요. 매장이 승인되고 첫 출금이 성공한 달에 확정돼요. 세금(3.3%)은 지급 때 떼요.</div>
      </div>
      <div className="flex flex-col justify-center rounded-2xl bg-ink p-5 text-on-ink">
        <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-gold-lt">이 달 커미션</div>
        <div className="mt-1 font-serif text-[36px] font-bold text-gold-lt">{won(monthly)}</div>
        <div className="mt-1 text-[12px] opacity-80">Pro {pro}곳 · Max {max}곳 · 방문 세팅 {onsiteN}곳</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-xl bg-on-ink/10 p-3"><div className="opacity-70">석 달 이 속도면</div><div className="mt-0.5 font-bold">{won(monthly * 3)}</div></div>
          <div className="rounded-xl bg-on-ink/10 p-3"><div className="opacity-70">1년이면</div><div className="mt-0.5 font-bold">{won(monthly * 12)}</div></div>
        </div>
        <div className="mt-4 text-[11px] leading-[1.7] opacity-80">
          매장 하나 소개하는 데 드는 건 카톡 한 통과 시연 5분이에요. 물건을 사 오거나 재고를 쌓을 일이 없고, 한도도 없어요.
        </div>
      </div>
    </div>
  );
}
