import Link from "next/link";
import { Avatar, Card } from "@/components/ui";
import type { StaffSummary } from "@/lib/queries";

export function StaffCard({ s, href }: { s: StaffSummary; href: string }) {
  const low = s.remainingHoursToday <= 2;
  return (
    <Link href={href} className="block">
      <Card className="flex items-center gap-3.5 p-3.5 transition-transform active:scale-[.99]">
        <Avatar src={s.photos[0]} name={s.nickname} size={76} rounded={20} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-serif text-[17px] font-bold text-ink">{s.nickname}</span>
            <span className="font-semibold text-[12px] text-brand">{s.hourlyPrice.toLocaleString("ko-KR")}원<span className="text-[10px] font-medium text-mute">/1시간</span></span>
            {s.rating !== null && (
              <span className="rounded-full bg-blush-lt px-2 py-[3px] text-[10px] font-semibold text-brand">★ {s.rating.toFixed(1)}</span>
            )}
          </div>
          <div className="mt-1.5 truncate text-[12px] text-mute">{s.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}</div>

          {/* 고를 때 실제로 보는 값들 — 목록에서도 바로 비교할 수 있게 한 줄로 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px]">
            {s.heightCm && <span className="rounded-md bg-well-2 px-1.5 py-0.5 font-semibold text-ink">{s.heightCm}cm</span>}
            {s.weightKg && <span className="rounded-md bg-well-2 px-1.5 py-0.5 font-semibold text-ink">{s.weightKg}kg</span>}
            {s.bustSize && (
              <span className="rounded-md bg-well-2 px-1.5 py-0.5 font-semibold text-ink">
                {s.bustSize}컵{s.bustNatural && <span className="text-brand"> 자연</span>}
              </span>
            )}
            {!s.smoker && <span className="rounded-md bg-ok-bg px-1.5 py-0.5 font-semibold text-ok">비흡연</span>}
            {!s.tattoo && <span className="rounded-md bg-ok-bg px-1.5 py-0.5 font-semibold text-ok">문신 없음</span>}
            {s.tattoo && <span className="rounded-md bg-well-2 px-1.5 py-0.5 font-semibold text-mute">문신 {s.tattooNote || "있음"}</span>}
            {s.optionNames.map((n) => (
              <span key={n} className="rounded-md bg-blush-lt px-1.5 py-0.5 font-semibold text-brand">{n}</span>
            ))}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold">
            <span className={s.upCount > 0 ? "text-brand" : "text-mute"}>👍 {s.upCount}</span>
            {s.downCount > 0 && <span className="text-mute">👎 {s.downCount}</span>}
            <span className="text-mute">리뷰 {s.reviewCount}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {/* 지금 되는 사람은 배지 두 개, 오늘만 되는 사람은 '오늘' 하나 */}
            {s.availableNow && (
              <span className="rounded-full bg-ok-bg px-2 py-[3px] text-[10px] font-bold text-ok">● 지금 예약 가능</span>
            )}
            {s.remainingHoursToday > 0 && (
              <span className="rounded-full bg-blush-lt px-2 py-[3px] text-[10px] font-bold text-brand">오늘 예약 가능</span>
            )}
            <span className={`text-[11px] font-semibold ${s.remainingHoursToday === 0 ? "text-mute" : low ? "text-brand" : "text-mute"}`}>
              {s.remainingHoursToday === 0
                ? "오늘은 마감"
                : s.availableNow
                  ? `${s.remainingHoursToday}시간 남음`
                  : `${s.nextOpenTime}부터 · ${s.remainingHoursToday}시간 남음`}
            </span>
          </div>
        </div>
        <span className="text-blush">›</span>
      </Card>
    </Link>
  );
}
