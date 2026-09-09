import Link from "next/link";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { staffStats } from "@/lib/metrics";
import { parseJsonArray } from "@/lib/utils";
import { parseFieldOptions, type ProfileFieldDef } from "@/lib/profile";
import { Eyebrow } from "@/components/ui";
import { StaffManager, type StaffFull } from "./staff-manager";
import { staffLabelOf } from "@/lib/labels";

export default async function StaffPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { slug } = await params;
  const { edit } = await searchParams;
  const store = await getStoreBySlug(slug);
  const [staff, storeOptions, fields] = await Promise.all([
    prisma.staff.findMany({ where: { storeId: store.id }, orderBy: { sortOrder: "asc" }, include: { options: { select: { id: true } }, profileValues: { select: { fieldId: true, value: true } } } }),
    prisma.storeOption.findMany({ where: { storeId: store.id }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, price: true } }),
    prisma.storeProfileField.findMany({ where: { storeId: store.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const profileFields: ProfileFieldDef[] = fields.map((x) => ({ id: x.id, label: x.label, kind: x.kind === "TEXT" ? "TEXT" : "CHOICE", options: parseFieldOptions(x.options), showInFilter: x.showInFilter }));
  const items: StaffFull[] = await Promise.all(
    staff.map(async (s) => {
      const st = await staffStats(s.id);
      return {
        id: s.id, nickname: s.nickname, bio: s.bio, tags: parseJsonArray(s.tags), photos: parseJsonArray(s.photos),
        isActive: s.isActive, capacityPerSlot: s.capacityPerSlot, hourlyPrice: s.hourlyPrice, adminMemo: s.adminMemo, loginId: s.loginId ?? "",
        heightCm: s.heightCm, weightKg: s.weightKg,
        smoker: s.smoker, tattoo: s.tattoo, tattooNote: s.tattooNote,
        optionIds: s.options.map((o) => o.id),
        profileValues: Object.fromEntries(s.profileValues.map((v) => [v.fieldId, v.value])),
        stats: {
          rating: st.rating, reviewCount: st.reviewCount, reservationCount: st.reservationCount, completedCount: st.completedCount,
          noshowRate: Math.round(st.noshowRate * 100), revisitRate: Math.round(st.revisitRate * 100), upCount: st.upCount, downCount: st.downCount,
          customerCount: st.customerCount, repeatCustomers: st.repeatCustomers, newCustomers30d: st.newCustomers30d,
        },
      };
    }),
  );
  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Staff</Eyebrow>
          <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">직원({staffLabelOf(store)}) 관리</h1>
        </div>
        <Link href={`/${slug}/admin/staff/schedule`} className="cta-grad rounded-2xl px-4 py-2.5 text-[13px] font-bold text-white shadow-cta">출근 · 룸 배치 ›</Link>
      </div>
      <StaffManager slug={slug} items={items} storeOptions={storeOptions} profileFields={profileFields} initialEdit={edit} />
    </div>
  );
}
