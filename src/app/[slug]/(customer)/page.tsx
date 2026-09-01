import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { listStaffSummaries } from "@/lib/queries";
import { businessDayOf, isStoreClosed } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { getCustomer } from "@/lib/auth";
import { Chip, Eyebrow, Sticker } from "@/components/ui";
import { InstallApp } from "@/components/install-app";

// 지금 자리가 있는지는 매 순간 달라지므로 캐시하지 않는다
export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const [staff, me, notices] = await Promise.all([
    listStaffSummaries(store),
    getCustomer(store.id),
    prisma.notice.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);
  const today = new Date();
  const closed = isStoreClosed(store, businessDayOf(store, today));
  const openStaff = staff.filter((s) => s.remainingHoursToday > 0);
  const nowStaff = staff.filter((s) => s.availableNow);

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
        {/* 매장 설정에서 바꾼 문구. {n} 은 오늘 예약 가능한 캐치걸 수로 채운다 */}
        <h1 className="mt-3 whitespace-pre-line font-serif text-[25px] font-bold leading-[1.5] text-ink">
          {store.heroTitle.replaceAll("{n}", String(openStaff.length))}
        </h1>
        <div className="mt-2 text-[12px] text-mute">
          {format(today, "M월 d일 EEEE", { locale: ko })} · {store.tagline}
        </div>
        <Sticker k="p1" size={104} className="absolute -bottom-2.5 -right-1.5 opacity-95" />
      </div>

      {/* 예약하러 가기 — 캐치걸 목록은 예약 탭에서 본다 */}
      <Link
        href={`/${slug}/bartenders`}
        className="cta-grad mx-4 mt-5 flex items-center gap-3 rounded-[22px] px-[18px] py-4 shadow-cta"
      >
        <div className="flex-1">
          <div className="text-[14px] font-bold text-white">캐치걸 보고 예약하기</div>
          <div className="mt-0.5 text-[11px] text-white/85">
            {nowStaff.length > 0 ? `지금 바로 가능한 캐치걸 ${nowStaff.length}명` : `오늘 예약 가능한 캐치걸 ${openStaff.length}명`}
          </div>
        </div>
        <span className="text-[18px] text-white/90">›</span>
      </Link>

      <InstallApp role="customer" className="mx-4 mt-4" />

      {/* 공지사항 */}
      {notices.length > 0 && (
        <section className="px-4 pt-6">
          <div className="mb-3 flex items-baseline gap-2 px-1">
            <Eyebrow>Notice</Eyebrow>
            <h2 className="text-[13px] font-bold text-ink">공지사항</h2>
          </div>
          <div className="flex flex-col gap-2.5">
            {notices.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "rounded-[20px] border px-[18px] py-4",
                  n.isPinned ? "border-brand/30 bg-blush-lt/60" : "border-line bg-white",
                )}
              >
                <div className="flex items-start gap-2">
                  {n.isPinned && <Chip>필독</Chip>}
                  <div className="mt-0.5 text-[13px] font-bold text-ink">{n.title}</div>
                </div>
                <p className="mt-2 whitespace-pre-line text-[12px] leading-[1.8] text-mute">{n.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

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
