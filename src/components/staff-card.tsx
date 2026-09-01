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
          {(s.upCount > 0 || s.downCount > 0) && (
            <div className="mt-1.5 flex items-center gap-2.5 text-[11px] font-semibold">
              <span className="text-brand">👍 {s.upCount}</span>
              {s.downCount > 0 && <span className="text-mute">👎 {s.downCount}</span>}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {/* 지금 되는 사람은 배지 두 개, 오늘만 되는 사람은 '오늘' 하나 */}
            {s.availableNow && (
              <span className="rounded-full bg-[#E8F6EE] px-2 py-[3px] text-[10px] font-bold text-[#2E8B57]">● 지금 예약 가능</span>
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
