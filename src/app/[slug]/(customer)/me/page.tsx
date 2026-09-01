import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { getCustomer } from "@/lib/auth";
import { computeCustomerStats } from "@/lib/metrics";
import { parseJsonArray } from "@/lib/utils";
import { Avatar, Card, Eyebrow, GradeChip, Stars, TopBar } from "@/components/ui";
import { HistoryTabs, type HistoryItem } from "./history-tabs";
import { ProfileForm } from "./profile-form";
import { logoutCustomer } from "../actions";

export default async function MyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const me = await getCustomer(store.id);
  if (!me) redirect(`/${slug}/login?next=/${slug}/me`);

  const [reservations, reviews, favorites] = await Promise.all([
    prisma.reservation.findMany({ where: { customerId: me.id }, orderBy: { startTime: "desc" }, include: { staff: true, review: { select: { id: true } } } }),
    prisma.review.findMany({ where: { customerId: me.id }, orderBy: { createdAt: "desc" }, include: { staff: { select: { id: true, nickname: true } } } }),
    prisma.favorite.findMany({ where: { customerId: me.id }, include: { staff: true } }),
  ]);
  const stats = computeCustomerStats(reservations);
  const items: HistoryItem[] = reservations.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    hours: r.hours,
    totalPrice: r.totalPrice,
    partySize: r.partySize,
    staffId: r.staffId,
    staffName: r.staff.nickname,
    staffPhoto: parseJsonArray(r.staff.photos)[0] ?? null,
    hasReview: !!r.review,
  }));
  const nextGoal = stats.grade === "신규" ? 5 - stats.visitCount : stats.grade === "단골" ? 10 - stats.visitCount : 0;

  return (
    <div className="animate-fade">
      <TopBar title="마이페이지" />
      {/* 프로필 */}
      <div className="hero-grad mx-4 mt-4 rounded-[24px] p-5">
        <div className="flex items-center gap-3.5">
          <Avatar name={me.nickname} size={56} rounded={18} className="bg-white" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-serif text-[20px] font-bold text-ink">{me.nickname}</span>
              <GradeChip grade={stats.grade} />
            </div>
            <div className="mt-1 text-[11px] text-mute">가입 {stats.visitCount > 0 ? `· 누적 ${stats.visitCount}회 방문` : "· 첫 방문을 기다리고 있어요"}</div>
          </div>
          <form action={logoutCustomer.bind(null, slug)}>
            <button className="rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-semibold text-mute">로그아웃</button>
          </form>
        </div>
        <div className="mt-4 flex rounded-2xl bg-white/80 py-3">
          {[
            ["누적 방문", `${stats.visitCount}회`],
            ["예정", `${reservations.filter((r) => r.status === "CONFIRMED").length}건`],
            ["후기", `${reviews.length}개`],
          ].map(([k, v], i) => (
            <div key={k} className={`flex-1 text-center ${i ? "border-l border-line" : ""}`}>
              <div className="font-serif text-[17px] font-bold text-brand">{v}</div>
              <div className="mt-0.5 text-[10px] text-mute">{k}</div>
            </div>
          ))}
        </div>
        {nextGoal > 0 && (
          <div className="mt-3 text-[11px] text-mute">
            {nextGoal}번 더 방문하면 <b className="text-brand">{stats.grade === "신규" ? "단골" : "VIP"}</b> 등급이 돼요
          </div>
        )}
      </div>
      <div className="px-4">
        <ProfileForm slug={slug} me={{ nickname: me.nickname, referral: me.referral ?? "" }} />
      </div>

      {/* 예약 히스토리 */}
      <section className="px-4 pt-6">
        <Eyebrow className="px-1">Reservations</Eyebrow>
        <h2 className="mt-1 px-1 font-serif text-[17px] font-bold text-ink">예약 히스토리</h2>
        <HistoryTabs slug={slug} items={items} />
      </section>

      {/* 찜한 캐치걸 */}
      <section className="px-4 pt-7">
        <Eyebrow className="px-1">Favorites</Eyebrow>
        <h2 className="mt-1 px-1 font-serif text-[17px] font-bold text-ink">찜한 캐치걸</h2>
        {favorites.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">아직 찜한 캐치걸가 없어요</div>
        ) : (
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
            {favorites.map((f) => (
              <Link key={f.id} href={`/${slug}/bartenders/${f.staffId}`} className="flex min-w-[120px] flex-col items-center rounded-[20px] border border-line bg-white p-3">
                <Avatar src={parseJsonArray(f.staff.photos)[0]} name={f.staff.nickname} size={56} rounded={18} />
                <div className="mt-2 text-[13px] font-bold text-ink">{f.staff.nickname}</div>
                <div className="text-[10px] text-brand">♥ 찜</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 내가 쓴 후기 */}
      <section className="px-4 pb-8 pt-7">
        <Eyebrow className="px-1">My Reviews</Eyebrow>
        <h2 className="mt-1 px-1 font-serif text-[17px] font-bold text-ink">내가 쓴 후기</h2>
        {reviews.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">방문을 완료하면 후기를 남길 수 있어요</div>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {reviews.map((r) => (
              <Card key={r.id} className="p-3.5 shadow-none">
                <div className="flex items-center gap-2">
                  <Link href={`/${slug}/bartenders/${r.staff.id}`} className="text-[12px] font-bold text-ink">{r.staff.nickname}</Link>
                  <Stars value={r.rating} size={10} />
                  {r.isHidden && <span className="ml-auto text-[10px] text-mute">숨김 처리됨</span>}
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.7] text-mute">{r.content}</p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
