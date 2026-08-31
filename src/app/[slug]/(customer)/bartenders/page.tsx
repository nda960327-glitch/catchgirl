import { getStoreBySlug } from "@/lib/store";
import { listStaffSummaries } from "@/lib/queries";
import { TopBar, Sticker } from "@/components/ui";
import { StaffCard } from "@/components/staff-card";

export default async function BartenderListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const staff = await listStaffSummaries(store);
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
      <div className="flex flex-col gap-3.5 px-4 pt-4">
        {staff.map((s) => (
          <StaffCard key={s.id} s={s} href={`/${slug}/bartenders/${s.id}`} />
        ))}
      </div>
    </div>
  );
}
