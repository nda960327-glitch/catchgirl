import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { getCustomer } from "@/lib/auth";
import { staffStats } from "@/lib/metrics";
import { computeCustomerStats } from "@/lib/metrics";
import { profileChips } from "@/lib/profile";
import { parseJsonArray } from "@/lib/utils";
import { TopBar } from "@/components/ui";
import { ProfileClient, type ReviewItem, type CommentItem } from "./profile-client";

export default async function BartenderDetail({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const store = await getStoreBySlug(slug);
  const staff = await prisma.staff.findUnique({ where: { id }, include: { schedules: true } });
  if (!staff || staff.storeId !== store.id) notFound();
  const me = await getCustomer(store.id);

  const [stats, reviews, comments, fav, votes, myVote] = await Promise.all([
    staffStats(staff.id),
    prisma.review.findMany({
      where: { staffId: staff.id, isHidden: false },
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { id: true, nickname: true, reservations: { select: { status: true, startTime: true, staffId: true } } } } },
    }),
    prisma.comment.findMany({
      where: { staffId: staff.id, isHidden: false, parentId: null },
      orderBy: { createdAt: "desc" },
      include: { replies: { where: { isHidden: false }, orderBy: { createdAt: "asc" } } },
    }),
    me ? prisma.favorite.findUnique({ where: { customerId_staffId: { customerId: me.id, staffId: staff.id } } }) : null,
    prisma.staffVote.groupBy({ by: ["value"], where: { staffId: staff.id }, _count: { value: true } }),
    me ? prisma.staffVote.findUnique({ where: { customerId_staffId: { customerId: me.id, staffId: staff.id } } }) : null,
  ]);
  const countOf = (v: string) => votes.find((x) => x.value === v)?._count.value ?? 0;

  const reviewItems: ReviewItem[] = reviews.map((r) => ({
    id: r.id,
    nickname: r.customer.nickname,
    grade: computeCustomerStats(r.customer.reservations).grade,
    rating: r.rating,
    content: r.content,
    photos: parseJsonArray(r.photos),
    reply: r.reply,
    createdAt: r.createdAt.toISOString(),
    mine: me?.id === r.customer.id,
  }));
  const commentItems: CommentItem[] = comments.map((c) => ({
    id: c.id,
    authorName: c.authorName,
    authorType: c.authorType,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    replies: c.replies.map((x) => ({ id: x.id, authorName: x.authorName, authorType: x.authorType, content: x.content, createdAt: x.createdAt.toISOString(), replies: [] })),
  }));

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title={staff.nickname} back={`/${slug}/bartenders`} />
      <ProfileClient
        slug={slug}
        staff={{ id: staff.id, nickname: staff.nickname, bio: staff.bio, tags: parseJsonArray(staff.tags), photos: parseJsonArray(staff.photos), hourlyPrice: staff.hourlyPrice, facts: profileChips(staff) }}
        stats={{ rating: stats.rating, reviewCount: stats.reviewCount, revisitRate: Math.round(stats.revisitRate * 100) }}
        reviews={reviewItems}
        comments={commentItems}
        loggedIn={!!me}
        favorited={!!fav}
        votes={{ up: countOf("UP"), down: countOf("DOWN"), my: (myVote?.value as "UP" | "DOWN" | undefined) ?? null }}
      />
      <div className="sticky bottom-0 border-t border-line bg-white/95 p-4 backdrop-blur">
        <Link href={`/${slug}/book/${staff.id}`} className="cta-grad flex h-[54px] w-full items-center justify-center rounded-2xl text-[15px] font-bold text-white shadow-cta">
          {staff.nickname} 예약하기
        </Link>
      </div>
    </div>
  );
}
