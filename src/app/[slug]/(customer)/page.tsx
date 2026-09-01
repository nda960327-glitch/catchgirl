import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { getStoreBySlug } from "@/lib/store";
import { listStaffSummaries } from "@/lib/queries";
import { isStoreClosed } from "@/lib/slots";
import { ymd } from "@/lib/utils";
import { getCustomer } from "@/lib/auth";
import { Chip, Eyebrow, Sticker } from "@/components/ui";
import { StaffCard } from "@/components/staff-card";

export default async function HomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const [staff, me] = await Promise.all([listStaffSummaries(store), getCustomer(store.id)]);
  const today = new Date();
  const closed = isStoreClosed(store, ymd(today));
  const openStaff = staff.filter((s) => s.remainingToday > 0);

  return (
    <div className="animate-fade">
      {/* 히어로 */}
      <div className="hero-grad relative overflow-hidden rounded-b-[28px] px-[22px] pb-8 pt-9">
        <div className="flex items-center gap-2">
          {store.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} className="h-8 w-8 rounded-[10px] border border-white shadow-card" />
          )}
          <Eyebrow>{store.name}</Eyebrow>
          <Chip tone={closed ? "mute" : "green"} className="ml-auto">
            {closed ? "오늘 휴무" : `오늘 영업 · ${store.openTime} 오픈`}
          </Chip>
        </div>
        <h1 className="mt-3 font-serif text-[25px] font-bold leading-[1.5] text-ink">
          오늘 자리를 지키는
          <br />
          {openStaff.length > 0 ? `${openStaff.length === staff.length ? "세" : openStaff.length} 사람` : "사람들"}
        </h1>
        <div className="mt-2 text-[12px] text-mute">
          {format(today, "M월 d일 EEEE", { locale: ko })} · {store.tagline}
        </div>
        <Sticker k="p1" size={104} className="absolute -bottom-2.5 -right-1.5 opacity-95" />
      </div>

      {/* 오늘 예약 가능한 캐치걸 */}
      <section className="px-4 pt-5">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-bold text-ink">오늘 예약 가능한 캐치걸</h2>
          <Link href={`/${slug}/bartenders`} className="text-[11px] font-semibold text-brand">
            전체 보기 ›
          </Link>
        </div>
        <div className="flex flex-col gap-3.5">
          {staff.map((s) => (
            <StaffCard key={s.id} s={s} href={`/${slug}/bartenders/${s.id}`} />
          ))}
        </div>
      </section>

      {/* 배너 */}
      <Link href={me ? `/${slug}/me` : `/${slug}/login`} className="mx-4 mt-[22px] flex items-center gap-3 rounded-[22px] bg-gradient-to-r from-blush-lt to-[#FFF8F4] px-[18px] py-[18px]">
        <Sticker k="p8" size={64} />
        <div>
          <div className="text-[13px] font-bold text-ink">{me ? `${me.nickname}님, 다녀온 자리를 기억해 두었어요` : "다녀온 자리, 기억해 두었어요"}</div>
          <div className="mt-1 text-[11px] text-mute">{me ? "후기를 남기면 다음 방문이 더 편해져요" : "닉네임과 PIN만으로 시작할 수 있어요"}</div>
        </div>
      </Link>

      <div className="mt-6 px-6 pb-6 text-center text-[10px] tracking-wider text-mute/80">
        {store.openTime}–{store.closeTime} · 방문 {store.cancelDeadlineHours}시간 전까지 취소 가능
      </div>
    </div>
  );
}
