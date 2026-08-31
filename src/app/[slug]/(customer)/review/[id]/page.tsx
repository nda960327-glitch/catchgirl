import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { getCustomer } from "@/lib/auth";
import { fmtDateTimeKo, parseJsonArray } from "@/lib/utils";
import { Avatar, TopBar } from "@/components/ui";
import { ReviewForm } from "./review-form";

export default async function ReviewPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const store = await getStoreBySlug(slug);
  const me = await getCustomer(store.id);
  if (!me) redirect(`/${slug}/login?next=/${slug}/review/${id}`);
  const r = await prisma.reservation.findUnique({ where: { id }, include: { staff: true, review: true } });
  if (!r || r.customerId !== me.id) notFound();
  if (r.status !== "COMPLETED" || r.review) redirect(`/${slug}/me`);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar title="후기 쓰기" back={`/${slug}/me`} />
      <div className="flex items-center gap-3 px-5 pt-5">
        <Avatar src={parseJsonArray(r.staff.photos)[0]} name={r.staff.nickname} size={52} rounded={17} />
        <div>
          <div className="font-serif text-[17px] font-bold text-ink">{r.staff.nickname}</div>
          <div className="mt-0.5 text-[11px] text-mute">{fmtDateTimeKo(r.startTime)} 방문</div>
        </div>
      </div>
      <ReviewForm slug={slug} reservationId={r.id} />
    </div>
  );
}
