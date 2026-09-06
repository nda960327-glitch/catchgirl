"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button, Card, Chip, Empty, Stars, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import { staffReplyComment, staffReplyReview } from "../../actions";

export type SReview = { id: string; customerName: string; rating: number; content: string; reply: string | null; createdAt: string };
export type SComment = { id: string; authorName: string; authorType: string; content: string; createdAt: string; replies: SComment[] };

export function StaffReviews({ slug, reviews, comments, stats }: { slug: string; reviews: SReview[]; comments: SComment[]; stats: { rating: number | null; reviewCount: number; revisitRate: number } }) {
  const [tab, setTab] = useState<"reviews" | "comments">("reviews");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const send = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? "답글을 남겼어요" : r.error ?? "실패", r.ok ? "success" : "error");
      if (r.ok) { setReplyFor(null); setText(""); router.refresh(); }
    });

  const unanswered = comments.filter((c) => !c.replies.some((r) => r.authorType !== "CUSTOMER")).length;

  return (
    <div className="animate-fade">
      <div className="flex rounded-[20px] border border-line bg-card py-4">
        {[["평점", stats.rating !== null ? stats.rating.toFixed(1) : "–"], ["후기", String(stats.reviewCount)], ["재방문", `${stats.revisitRate}%`]].map(([k, v], i) => (
          <div key={k} className={cn("flex-1 text-center", i > 0 && "border-l border-line")}>
            <div className="font-serif text-[19px] font-bold text-brand">{v}</div>
            <div className="mt-1 text-[10px] text-mute">{k}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-5 border-b border-line">
        {(["reviews", "comments"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("-mb-px pb-2.5 text-[13px] font-bold", tab === t ? "border-b-2 border-brand text-ink" : "border-b-2 border-transparent text-mute")}>
            {t === "reviews" ? `후기 ${reviews.length}` : `댓글 ${comments.length}`}{t === "comments" && unanswered > 0 && <span className="ml-1 rounded-full bg-brand px-1.5 text-[9px] text-white">{unanswered}</span>}
          </button>
        ))}
      </div>

      {tab === "reviews" ? (
        reviews.length === 0 ? <Empty sticker="p6" title="아직 후기가 없어요" /> : (
          <div className="mt-3 flex flex-col gap-3">
            {reviews.map((r) => (
              <Card key={r.id} className="p-4 shadow-none">
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="font-bold text-ink">{r.customerName}</span>
                  <Stars value={r.rating} size={11} />
                  <span className="ml-auto text-[10px] text-mute">{format(new Date(r.createdAt), "yyyy.MM.dd")}</span>
                </div>
                <p className="mt-2 text-[13px] leading-[1.7] text-ink">{r.content}</p>
                {r.reply && replyFor !== r.id && <div className="mt-2 rounded-xl bg-blush-lt px-3 py-2 text-[12px]"><b className="text-brand">내 답글</b> <span className="text-ink">{r.reply}</span></div>}
                {replyFor === r.id ? (
                  <div className="mt-2">
                    <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="감사 인사를 남겨보세요" />
                    <div className="mt-1.5 flex gap-2">
                      <Button size="sm" onClick={() => send(() => staffReplyReview(slug, r.id, text))} loading={pending}>등록</Button>
                      <Button size="sm" variant="ghost" onClick={() => setReplyFor(null)}>취소</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setReplyFor(r.id); setText(r.reply ?? ""); }}>{r.reply ? "답글 수정" : "답글 달기"}</Button>
                )}
              </Card>
            ))}
          </div>
        )
      ) : comments.length === 0 ? <Empty sticker="p2" title="아직 댓글이 없어요" /> : (
        <div className="mt-3 flex flex-col gap-3">
          {comments.map((c) => (
            <Card key={c.id} className="p-4 shadow-none">
              <div className="flex items-center gap-2 text-[12px]">
                <span className="font-bold text-ink">{c.authorName}</span>
                <span className="ml-auto text-[10px] text-mute">{format(new Date(c.createdAt), "MM.dd HH:mm")}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink">{c.content}</p>
              {c.replies.map((x) => (
                <div key={x.id} className={cn("ml-4 mt-2 rounded-xl px-3 py-2 text-[12px]", x.authorType === "CUSTOMER" ? "border border-line" : "bg-blush-lt")}>
                  <span className="font-bold text-ink">{x.authorName}</span>{x.authorType !== "CUSTOMER" && <Chip className="ml-1">{x.authorType === "ADMIN" ? "매장" : "나"}</Chip>} <span className="text-ink">{x.content}</span>
                </div>
              ))}
              {replyFor === c.id ? (
                <div className="mt-2">
                  <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="답글" />
                  <div className="mt-1.5 flex gap-2">
                    <Button size="sm" onClick={() => send(() => staffReplyComment(slug, c.id, text))} loading={pending}>등록</Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyFor(null)}>취소</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setReplyFor(c.id); setText(""); }}>답글 달기</Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
