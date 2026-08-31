import Link from "next/link";
import { Avatar, Card } from "@/components/ui";
import type { StaffSummary } from "@/lib/queries";

export function StaffCard({ s, href }: { s: StaffSummary; href: string }) {
  const low = s.remainingToday <= 3;
  return (
    <Link href={href} className="block">
      <Card className="flex items-center gap-3.5 p-3.5 transition-transform active:scale-[.99]">
        <Avatar src={s.photos[0]} name={s.nickname} size={76} rounded={20} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-serif text-[17px] font-bold text-ink">{s.nickname}</span>
            {s.rating !== null && (
              <span className="rounded-full bg-blush-lt px-2 py-[3px] text-[10px] font-semibold text-brand">★ {s.rating.toFixed(1)}</span>
            )}
          </div>
          <div className="mt-1.5 truncate text-[12px] text-mute">{s.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}</div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${s.remainingToday === 0 ? "bg-[#DED2D4]" : low ? "bg-brand" : "bg-gold-lt"}`} />
            <span className={`text-[11px] font-semibold ${s.remainingToday === 0 ? "text-mute" : low ? "text-brand" : "text-mute"}`}>
              {s.remainingToday === 0 ? "오늘은 마감" : `오늘 남은 자리 ${s.remainingToday}`}
            </span>
          </div>
        </div>
        <span className="text-blush">›</span>
      </Card>
    </Link>
  );
}
