import Link from "next/link";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

type Item = { id: string; time: string; status: string; customer: string; party: number };

/** 간트 차트형 타임라인: 행 = 캐치걸, 열 = 슬롯 */
export function Timeline({ times, rows, nowTime }: { times: string[]; slotMinutes: number; rows: { id: string; name: string; photo: string | null; items: Item[] }[]; nowTime: string }) {
  const nowIdx = times.findIndex((t) => t > nowTime);
  return (
    <div className="mt-4 overflow-x-auto">
      <div style={{ minWidth: 120 + times.length * 52 }}>
        <div className="flex">
          <div className="w-[120px] shrink-0" />
          {times.map((t, i) => (
            <div key={t} className={cn("w-[52px] shrink-0 text-center text-[10px]", i === nowIdx ? "font-bold text-brand" : "text-mute")}>{t}</div>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.id} className="mt-2 flex items-center">
            <div className="flex w-[120px] shrink-0 items-center gap-2 pr-2">
              <Avatar src={row.photo} name={row.name} size={28} rounded={9} />
              <span className="text-[12px] font-bold text-ink">{row.name}</span>
            </div>
            {times.map((t, i) => {
              const it = row.items.find((x) => x.time === t);
              return (
                <div key={t} className={cn("relative h-10 w-[52px] shrink-0 border-l border-line/70", i === nowIdx && "bg-blush-lt/40")}>
                  {it && (
                    <Link
                      href={`?focus=${it.id}`}
                      title={it.customer}
                      className={cn(
                        "absolute inset-y-1 left-0.5 right-0.5 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold leading-tight",
                        it.status === "CONFIRMED" && "bg-brand text-white",
                        it.status === "COMPLETED" && "bg-[#E8F6EE] text-[#2E8B57]",
                        it.status === "NOSHOW" && "bg-[#FDECEC] text-[#C0392B]",
                      )}
                    >
                      <span className="max-w-full truncate px-0.5">{it.customer}</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
