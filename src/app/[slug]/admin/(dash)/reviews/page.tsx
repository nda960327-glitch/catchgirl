import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { parseJsonArray } from "@/lib/utils";
import { Eyebrow } from "@/components/ui";
import { ReviewsAdmin, type AdminReview, type AdminComment } from "./reviews-admin";

export default async function ReviewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const [reviews, comments] = await Promise.all([
    prisma.review.findMany({ where: { storeId: store.id }, orderBy: [{ isReported: "desc" }, { createdAt: "desc" }], include: { staff: true, customer: true } }),
    prisma.comment.findMany({ where: { storeId: store.id, parentId: null }, orderBy: { createdAt: "desc" }, include: { staff: true, replies: { orderBy: { createdAt: "asc" } } } }),
  ]);
  const rv: AdminReview[] = reviews.map((r) => ({
    id: r.id, staffName: r.staff.nickname, customerName: r.customer.nickname, rating: r.rating, content: r.content, photos: parseJsonArray(r.photos),
    isHidden: r.isHidden, isReported: r.isReported, reportReason: r.reportReason, reply: r.reply, createdAt: r.createdAt.toISOString(),
  }));
  const cm: AdminComment[] = comments.map((c) => ({
    id: c.id, staffName: c.staff.nickname, authorName: c.authorName, authorType: c.authorType, content: c.content, isHidden: c.isHidden, createdAt: c.createdAt.toISOString(),
    replies: c.replies.map((x) => ({ id: x.id, staffName: c.staff.nickname, authorName: x.authorName, authorType: x.authorType, content: x.content, isHidden: x.isHidden, createdAt: x.createdAt.toISOString(), replies: [] })),
  }));
  return (
    <div className="animate-fade">
      <Eyebrow>Reviews &amp; Comments</Eyebrow>
      <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">후기 · 댓글 관리</h1>
      <ReviewsAdmin slug={slug} reviews={rv} comments={cm} />
    </div>
  );
}
