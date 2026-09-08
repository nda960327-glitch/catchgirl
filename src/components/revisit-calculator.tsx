"use client";

import { useState } from "react";
import { won } from "@/lib/utils";

/**
 * 재방문율이 오르면 매출이 얼마나 오르는지 사장이 자기 숫자로 눌러 보는 계산기.
 *
 * 새 손님이 오는 속도는 그대로라고 두고, 재방문율만 올린다.
 * 한 달 방문 V 중 재방문이 r 이면 새 손님 방문은 V(1−r). 재방문율이 r' 가 되면
 * 전체 방문은 V(1−r)/(1−r') 로 늘어난다. 이 차이에 건당 매장 몫을 곱한 게 늘어나는 매출이다.
 */
export function RevisitCalculator() {
  const [visits, setVisits] = useState(300);
  const [unit, setUnit] = useState(200_000);
  const [rate, setRate] = useState(30);
  const [gain, setGain] = useState(10);

  const r = Math.min(95, Math.max(0, rate)) / 100;
  const r2 = Math.min(97, rate + gain) / 100;
  const newVisits = visits * (1 - r);
  const after = r2 < 1 ? newVisits / (1 - r2) : visits;
  const extraVisits = Math.max(0, Math.round(after - visits));
  const extraMonthly = extraVisits * unit;
  const nowMonthly = visits * unit;

  const Row = ({ label, value, set, min, max, step, suffix }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; suffix: string }) => (
    <label className="block">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className="font-mono font-bold text-brand">{value.toLocaleString("ko-KR")}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-1.5 w-full accent-[#B4586A]" />
    </label>
  );

  return (
    <div className="grid gap-5 rounded-[26px] bg-card p-6 shadow-card md:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="text-[13px] font-bold text-ink">우리 매장 숫자로 눌러 보세요</div>
        <Row label="한 달 방문 건수" value={visits} set={setVisits} min={50} max={1500} step={10} suffix="건" />
        <Row label="방문 1건당 매장 몫" value={unit} set={setUnit} min={50_000} max={600_000} step={10_000} suffix="원" />
        <Row label="지금 재방문율" value={rate} set={setRate} min={5} max={80} step={1} suffix="%" />
        <Row label="앱으로 올릴 재방문율" value={gain} set={setGain} min={3} max={30} step={1} suffix="%p" />
        <div className="text-[10px] leading-[1.7] text-mute">새로 오는 손님 수는 그대로라고 보고, 재방문율만 올렸을 때예요. 가정 계산이니 매장 숫자로 바꿔서 보세요.</div>
      </div>
      <div className="flex flex-col justify-center rounded-2xl bg-ink p-5 text-on-ink">
        <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-gold-lt">한 달에</div>
        <div className="mt-1 font-serif text-[34px] font-bold text-gold-lt">+{won(extraMonthly)}</div>
        <div className="mt-1 text-[12px] opacity-80">방문 {extraVisits}건이 더 생겨요 · 재방문율 {rate}% → {Math.min(97, rate + gain)}%</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-xl bg-on-ink/10 p-3">
            <div className="opacity-70">지금 월 매장 몫</div>
            <div className="mt-0.5 font-bold">{won(nowMonthly)}</div>
          </div>
          <div className="rounded-xl bg-on-ink/10 p-3">
            <div className="opacity-70">1년이면</div>
            <div className="mt-0.5 font-bold">+{won(extraMonthly * 12)}</div>
          </div>
        </div>
        <div className="mt-4 text-[11px] leading-[1.7] opacity-80">
          앱 요금은 한 달 {won(100_000)}이에요. 재방문 손님이 한 달에 <b>{Math.max(1, Math.ceil(100_000 / Math.max(unit, 1)))}명</b>만 더 와도 요금이 빠져요.
        </div>
      </div>
    </div>
  );
}
