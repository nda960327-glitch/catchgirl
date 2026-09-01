import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { parseJsonArray } from "@/lib/utils";
import { Eyebrow } from "@/components/ui";
import { SettingsForm } from "./settings-form";
import { OptionsManager } from "./options-manager";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const options = await prisma.storeOption.findMany({ where: { storeId: store.id }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="animate-fade">
      <Eyebrow>Store Settings</Eyebrow>
      <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">매장 설정 (화이트라벨)</h1>
      <p className="mt-1 text-[12px] text-mute">여기서 바꾼 로고·컬러·매장명·영업시간은 고객 화면에 즉시 반영돼요.</p>
      <SettingsForm
        slug={slug}
        init={{
          name: store.name, tagline: store.tagline, logoUrl: store.logoUrl, coverUrl: store.coverUrl, themeColor: store.themeColor,
          openTime: store.openTime, closeTime: store.closeTime, slotMinutes: store.slotMinutes, closedDays: parseJsonArray<number>(store.closedDays),
          cancelDeadlineHours: store.cancelDeadlineHours, maxAdvanceDays: store.maxAdvanceDays, noshowPolicy: store.noshowPolicy,
        }}
      />
      <OptionsManager slug={slug} items={options.map((o) => ({ id: o.id, name: o.name, price: o.price, isActive: o.isActive }))} />
    </div>
  );
}
