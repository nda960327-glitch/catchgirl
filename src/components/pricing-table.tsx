import { DEBIT_DAY, ONSITE_SETUP_FEE, PLANS, TERM_MONTHS, termDiscountPercent, type Plan } from "@/lib/plans";
import { won } from "@/lib/utils";

/**
 * 가격표 — 홈페이지와 가입 신청 페이지가 같은 표를 쓴다.
 * 무약정 정가 옆에 2년 약정가를 두어 "묶였다" 가 아니라 "싸게 샀다" 로 읽히게 한다.
 */
export function PricingTable({ compact = false }: { compact?: boolean }) {
  const plans = Object.keys(PLANS) as Plan[];
  const rows: { label: string; monthly: string; term: string; note?: string }[] = [
    ...plans.map((k) => ({
      label: PLANS[k].name,
      monthly: `${won(PLANS[k].price)}/월`,
      term: `${won(PLANS[k].termPrice)}/월`,
      note: `${termDiscountPercent(k)}% 할인`,
    })),
    { label: "방문 세팅", monthly: won(ONSITE_SETUP_FEE), term: "무료", note: "사진 촬영·명단 정리·직원 교육" },
    { label: "첫 달", monthly: "무료", term: "무료" },
  ];
  return (
    <div className="overflow-x-auto rounded-[22px] border border-line bg-card shadow-card">
      <table className={`w-full min-w-[480px] text-left ${compact ? "text-[12px]" : "text-[13px]"}`}>
        <thead>
          <tr className="border-b border-line bg-well text-[11px] font-bold text-mute">
            <th className="px-4 py-3"> </th>
            <th className="px-4 py-3">무약정 (월납)</th>
            <th className="px-4 py-3 text-brand">{TERM_MONTHS / 12}년 약정</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line/60 align-baseline last:border-0">
              <td className="px-4 py-3 font-bold text-ink">{r.label}</td>
              <td className="px-4 py-3 text-mute">{r.monthly}</td>
              <td className="px-4 py-3">
                <span className={`font-serif font-bold text-brand ${compact ? "text-[15px]" : "text-[18px]"}`}>{r.term}</span>
                {r.note && <span className="ml-1.5 rounded-full bg-blush-lt px-2 py-0.5 text-[10px] font-bold text-brand">{r.note}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-line px-4 py-2.5 text-[10px] leading-[1.7] text-mute">
        CMS 자동이체로 매월 {DEBIT_DAY}일 출금 · 약정을 중간에 해지하면 남은 기간이 아니라 그동안 받은 할인과 무료 방문 세팅비만 돌려주시면 돼요 · 무약정은 위약금 없음
      </div>
    </div>
  );
}
