import Link from "next/link";
import { getStoreBySlug } from "@/lib/store";
import { listStaffSummaries, sortStaffSummaries } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { TopBar, Sticker } from "@/components/ui";
import { StaffCard } from "@/components/staff-card";
import { SortSelect } from "./sort-select";

// 지금 자리가 있는지는 매 순간 달라지므로 캐시하지 않는다
export const dynamic = "force-dynamic";

export default async function BartenderListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; now?: string }>;
}) {
  const { slug } = await params;
  const { sort = "", now } = await searchParams;
  const store = await getStoreBySlug(slug);
  const all = sortStaffSummaries(await listStaffSummaries(store), sort);
  const onlyNow = now === "1";
  const nowCount = all.filter((s) => s.availableNow).length;
  const staff = onlyNow ? all.filter((s) => s.availableNow) : all;

  const href = (next: { now?: boolean }) => {
    const p = new URLSearchParams();
    if (sort) p.set("sort", sort);
    if (next.now) p.set("now", "1");
    const qs = p.toString();
    return `/${slug}/bartenders${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="animate-fade">
      <TopBar title="캐치걸" back={`/${slug}`} />
      <div className="flex items-center gap-3 px-5 pt-5">
        <Sticker k="p9" size={58} />
        <div>
          <div className="font-serif text-[18px] font-bold text-ink">누구와 함께 할까요</div>
          <div className="mt-1 text-[11px] text-mute">캐치걸를 고르면 날짜와 시간을 선택할 수 있어요</div>
        </div>
      </div>

      {/* 지금 예약 가능 필터 */}
      <div className="flex gap-2 px-4 pt-4">
        <Link
          href={href({ now: false })}
          scroll={false}
          className={cn(
            "flex-1 rounded-2xl px-3 py-2.5 text-center text-[12px] font-bold transition-colors",
            onlyNow ? "bg-[#F4EDEE] text-mute" : "bg-brand text-white",
          )}
        >
          전체 {all.length}
        </Link>
        <Link
          href={href({ now: true })}
          scroll={false}
          className={cn(
            "flex-1 rounded-2xl px-3 py-2.5 text-center text-[12px] font-bold transition-colors",
            onlyNow ? "bg-[#2E8B57] text-white" : "bg-[#E8F6EE] text-[#2E8B57]",
          )}
        >
          ● 지금 예약 가능 {nowCount}
        </Link>
      </div>

      <SortSelect slug={slug} sort={sort} now={onlyNow} />

      <div className="flex flex-col gap-3.5 px-4 pt-4">
        {staff.length === 0 ? (
          <div className="mt-4 flex flex-col items-center text-center">
            <Sticker k="p6" size={80} />
            <div className="mt-1 text-[13px] font-semibold text-ink">지금 바로 되는 자리가 없어요</div>
            <div className="mt-0.5 text-[11px] text-mute">조금 뒤 자리나 다른 날짜를 확인해 보세요</div>
            <Link href={href({ now: false })} className="mt-2 text-[11px] font-semibold text-brand">전체 캐치걸 보기 ›</Link>
          </div>
        ) : (
          staff.map((s) => <StaffCard key={s.id} s={s} href={`/${slug}/bartenders/${s.id}`} />)
        )}
      </div>
    </div>
  );
}
