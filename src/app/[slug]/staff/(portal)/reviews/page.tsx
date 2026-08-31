import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { requireStaff } from "@/lib/auth";
import { staffStats } from "@/lib/metrics";
import { StaffReviews, type SReview, type SComment } from "./staff-reviews";

export default async function StaffReviewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const me = await requireStaff(store.id);
  const [reviews, comments, stats] = await Promise.all([
    prisma.review.findMany({ where: { staffId: me.id, isHidden: false }, orderBy: { createdAt: "desc" }, include: { customer: true } }),
    prisma.comment.findMany({ where: { staffId: me.id, isHidden: false, parentId: null }, orderBy: { createdAt: "desc" }, include: { replies: { where: { isHidden: false }, orderBy: { createdAt: "asc" } } } }),
    staffStats(me.id),
  ]);
  const rv: SReview[] = reviews.map((r) => ({ id: r.id, customerName: r.customer.nickname, rating: r.rating, content: r.content, reply: r.reply, createdAt: r.createdAt.toISOString() }));
  const cm: SComment[] = comments.map((c) => ({ id: c.id, authorName: c.authorName, authorType: c.authorType, content: c.content, createdAt: c.createdAt.toISOString(), replies: c.replies.map((x) => ({ id: x.id, authorName: x.authorName, authorType: x.authorType, content: x.content, createdAt: x.createdAt.toISOString(), replies: [] })) }));
  return <StaffReviews slug={slug} reviews={rv} comments={cm} stats={{ rating: stats.rating, reviewCount: stats.reviewCount, revisitRate: Math.round(stats.revisitRate * 100) }} />;
}
