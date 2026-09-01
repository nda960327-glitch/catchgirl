import Link from "next/link";
import { getStoreBySlug } from "@/lib/store";
import { listStaffSummaries, sortStaffSummaries, STAFF_SORTS } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { TopBar, Sticker } from "@/components/ui";
import { StaffCard } from "@/components/staff-card";

export default async function BartenderListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const { sort = "" } = await searchParams;
  const store = await getStoreBySlug(slug);
  const staff = sortStaffSummaries(await listStaffSummaries(store), sort);

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

      {/* 정렬 */}
      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto px-4">
        {STAFF_SORTS.map(([k, label]) => (
          <Link
            key={k || "default"}
            href={k ? `/${slug}/bartenders?sort=${k}` : `/${slug}/bartenders`}
            scroll={false}
            className={cn(
              "whitespace-nowrap rounded-full px-3.5 py-2 text-[11.5px] font-bold transition-colors",
              sort === k ? "bg-brand text-white" : "bg-[#F4EDEE] text-mute",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3.5 px-4 pt-4">
        {staff.map((s) => (
          <StaffCard key={s.id} s={s} href={`/${slug}/bartenders/${s.id}`} />
        ))}
      </div>
    </div>
  );
}
