import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { getCustomer } from "@/lib/auth";
import { computeCustomerStats } from "@/lib/metrics";
import { resolveRooms } from "@/lib/reservations";
import { format } from "date-fns";
import { parseJsonArray, won } from "@/lib/utils";
import { usableCoupons } from "@/lib/discounts";
import { Avatar, Card, Eyebrow, GradeChip, Stars, TopBar } from "@/components/ui";
import { HistoryTabs, type HistoryItem } from "./history-tabs";
import { ProfileForm } from "./profile-form";
import { logoutCustomer } from "../actions";
import { josa, staffLabelOf } from "@/lib/labels";
import { ReportButton } from "@/components/report-button";

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
  // 배치가 나중에 정해질 수 있으니 저장값이 아니라 지금 배치를 본다
  const rooms = await resolveRooms(store, reservations);
  const items: HistoryItem[] = reservations.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    hours: r.hours,
    totalPrice: r.totalPrice,
    roomName: rooms.get(r.id) ?? null,
    partySize: r.partySize,
    staffId: r.staffId,
    staffName: r.staff.nickname,
    staffPhoto: parseJsonArray(r.staff.photos)[0] ?? null,
    hasReview: !!r.review,
  }));
  const nextGoal = stats.grade === "신규" ? 5 - stats.visitCount : stats.grade === "단골" ? 10 - stats.visitCount : 0;

  const [coupons, benefitRow] = await Promise.all([
    usableCoupons(store.id, me.id),
    stats.grade === "신규" ? null : prisma.gradeBenefit.findUnique({ where: { storeId_grade: { storeId: store.id, grade: stats.grade } } }),
  ]);
  const benefit = benefitRow && benefitRow.isActive && benefitRow.amount > 0 ? benefitRow : null;

  return (
    <div className="animate-fade">
      <TopBar title="마이페이지" />
      {/* 프로필 */}
      <div className="hero-grad mx-4 mt-4 rounded-[24px] p-5">
        <div className="flex items-center gap-3.5">
          <Avatar name={me.nickname} size={56} rounded={18} className="bg-card" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-serif text-[20px] font-bold text-ink">{me.nickname}</span>
              <GradeChip grade={stats.grade} />
            </div>
            <div className="mt-1 text-[11px] text-mute">가입 {stats.visitCount > 0 ? `· 누적 ${stats.visitCount}회 방문` : "· 첫 방문을 기다리고 있어요"}</div>
          </div>
          <form action={logoutCustomer.bind(null, slug)}>
            <button className="rounded-full border border-line bg-card px-3 py-1.5 text-[10px] font-semibold text-mute">로그아웃</button>
          </form>
        </div>
        <div className="mt-4 flex rounded-2xl bg-card/80 py-3">
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
      {/* 쿠폰과 등급 혜택 — 예약 화면에서 자동으로 붙지만 여기서 미리 확인한다 */}
      {(coupons.length > 0 || benefit) && (
        <section className="px-4 pt-6">
          <Eyebrow className="px-1">Benefits</Eyebrow>
          <h2 className="mt-1 px-1 font-serif text-[17px] font-bold text-ink">내 혜택</h2>
          <div className="mt-3 flex flex-col gap-2">
            {benefit && (
              <div className="rounded-[18px] border border-line bg-card px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <GradeChip grade={stats.grade} />
                  <span className="text-[13px] font-bold text-brand">예약마다 {won(benefit.amount)} 할인</span>
                </div>
                {benefit.note && <p className="mt-1.5 text-[11px] leading-[1.8] text-mute">{benefit.note}</p>}
              </div>
            )}
            {coupons.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-[18px] border border-brand/30 bg-blush-lt/50 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-ink">{c.name}</div>
                  <div className="mt-0.5 text-[10px] text-mute">
                    {c.expiresAt ? `${format(c.expiresAt, "yyyy.MM.dd")}까지` : "기한 없음"} · 예약할 때 골라서 쓰세요
                  </div>
                </div>
                <span className="font-serif text-[17px] font-bold text-brand">{won(c.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="px-4 pt-6">
        <ProfileForm slug={slug} me={{ nickname: me.nickname }} />
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
        <h2 className="mt-1 px-1 font-serif text-[17px] font-bold text-ink">찜한 {staffLabelOf(store)}</h2>
        {favorites.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">아직 찜한 {josa(staffLabelOf(store), "이")} 없어요</div>
        ) : (
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
            {favorites.map((f) => (
              <Link key={f.id} href={`/${slug}/bartenders/${f.staffId}`} className="flex min-w-[120px] flex-col items-center rounded-[20px] border border-line bg-card p-3">
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

      {/* 문제가 있으면 — 매장 자체를 운영사에 알리는 길. 매장이 지우거나 막을 수 없다 */}
      <section className="px-4 pb-10">
        <div className="rounded-[20px] border border-line bg-card p-4">
          <div className="text-[12px] font-bold text-ink">문제가 있었나요?</div>
          <p className="mt-1 text-[11px] leading-[1.7] text-mute">
            성적인 요구, 욕설, 불법으로 보이는 일, 개인정보 요구가 있었다면 알려 주세요. 매장 관리자와 운영사에 같이 전달되고, 누가 알렸는지는 매장 직원에게 보이지 않아요.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ReportButton slug={slug} role="customer" variant="pill" label="이 매장 신고하기" target={{ type: "STORE", id: store.id, name: store.name }} />
            <Link href="/platform/privacy" target="_blank" className="text-[10px] text-mute underline-offset-2 hover:underline">개인정보처리방침</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
