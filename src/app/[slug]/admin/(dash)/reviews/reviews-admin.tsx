"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button, Card, Chip, Stars, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import { adminCommentAction, adminReviewAction } from "../../actions";

export type AdminReview = { id: string; staffName: string; customerName: string; rating: number; content: string; photos: string[]; isHidden: boolean; isReported: boolean; reportReason: string | null; reply: string | null; createdAt: string };
export type AdminComment = { id: string; staffName: string; authorName: string; authorType: string; content: string; isHidden: boolean; createdAt: string; replies: AdminComment[] };
type ActFn = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => void;

export function ReviewsAdmin({ slug, reviews, comments }: { slug: string; reviews: AdminReview[]; comments: AdminComment[] }) {
  const [tab, setTab] = useState<"reviews" | "comments">("reviews");
  const [filter, setFilter] = useState<"all" | "reported" | "hidden">("all");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const act: ActFn = (fn, msg) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? msg : r.error ?? "실패", r.ok ? "success" : "error");
      if (r.ok) { setReplyFor(null); setReplyText(""); router.refresh(); }
    });

  const list = reviews.filter((r) => (filter === "all" ? true : filter === "reported" ? r.isReported : r.isHidden));
  const reportedCount = reviews.filter((r) => r.isReported).length;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-2xl bg-white p-1 shadow-card">
          {(["reviews", "comments"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("rounded-xl px-4 py-2 text-[12px] font-bold", tab === t ? "bg-brand text-white" : "text-mute")}>
              {t === "reviews" ? `후기 ${reviews.length}` : `댓글 ${comments.length}`}
            </button>
          ))}
        </div>
        {tab === "reviews" && (
          <div className="ml-2 flex gap-1.5">
            {([["all", "전체"], ["reported", `신고됨 ${reportedCount}`], ["hidden", "숨김"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold", filter === k ? "bg-ink text-white" : "bg-[#F4EDEE] text-mute", k === "reported" && reportedCount > 0 && filter !== k && "text-[#C0392B]")}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {tab === "reviews" ? (
        <div className="mt-4 flex flex-col gap-3">
          {list.length === 0 && <Card className="p-8 text-center text-[12px] text-mute">해당하는 후기가 없어요</Card>}
          {list.map((r) => (
            <Card key={r.id} className={cn("p-4", r.isReported && "border-[#F5B5B5]", r.isHidden && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="font-bold text-ink">{r.customerName}</span>
                <span className="text-mute">→ {r.staffName}</span>
                <Stars value={r.rating} size={11} />
                {r.isReported && <Chip tone="red">신고 · {r.reportReason ?? "사유 없음"}</Chip>}
                {r.isHidden && <Chip tone="mute">숨김</Chip>}
                <span className="ml-auto text-[10px] text-mute">{format(new Date(r.createdAt), "yyyy.MM.dd HH:mm")}</span>
              </div>
              <p className="mt-2 text-[13px] leading-[1.7] text-ink">{r.content}</p>
              {r.photos.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {r.photos.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" />
                  ))}
                </div>
              )}
              {r.reply && replyFor !== r.id && (
                <div className="mt-2 rounded-xl bg-blush-lt px-3 py-2 text-[12px]">
                  <span className="font-bold text-brand">답글</span> <span className="text-ink">{r.reply}</span>
                </div>
              )}
              {replyFor === r.id && (
                <div className="mt-2">
                  <Textarea rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`${r.staffName} 캐치걸 이름으로 답글`} />
                  <div className="mt-1.5 flex gap-2">
                    <Button size="sm" onClick={() => act(() => adminReviewAction(slug, r.id, "reply", replyText), "답글을 남겼어요")} loading={pending}>등록</Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyFor(null)}>취소</Button>
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => { setReplyFor(r.id); setReplyText(r.reply ?? ""); }}>{r.reply ? "답글 수정" : "캐치걸 대신 답글"}</Button>
                {r.isReported && <Button size="sm" variant="outline" onClick={() => act(() => adminReviewAction(slug, r.id, "dismiss"), "신고를 기각했어요")} loading={pending}>문제 없음</Button>}
                {r.isHidden
                  ? <Button size="sm" variant="outline" onClick={() => act(() => adminReviewAction(slug, r.id, "show"), "다시 공개했어요")} loading={pending}>공개</Button>
                  : <Button size="sm" variant="danger" onClick={() => act(() => adminReviewAction(slug, r.id, "hide"), "숨김 처리했어요")} loading={pending}>숨김</Button>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {comments.length === 0 && <Card className="p-8 text-center text-[12px] text-mute">댓글이 없어요</Card>}
          {comments.map((c) => (
            <Card key={c.id} className="p-4">
              <CommentLine c={c} slug={slug} pending={pending} act={act} replyFor={replyFor} setReplyFor={setReplyFor} replyText={replyText} setReplyText={setReplyText} />
              {c.replies.map((x) => (
                <div key={x.id} className="ml-6 mt-2 border-l-2 border-line pl-3">
                  <CommentLine c={x} slug={slug} pending={pending} act={act} replyFor={replyFor} setReplyFor={setReplyFor} replyText={replyText} setReplyText={setReplyText} isReply />
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentLine({ c, slug, pending, act, replyFor, setReplyFor, replyText, setReplyText, isReply }: {
  c: AdminComment; slug: string; pending: boolean; act: ActFn;
  replyFor: string | null; setReplyFor: (v: string | null) => void; replyText: string; setReplyText: (v: string) => void; isReply?: boolean;
}) {
  return (
    <div className={cn(c.isHidden && "opacity-50")}>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-bold text-ink">{c.authorName}</span>
        {c.authorType !== "CUSTOMER" && <Chip>{c.authorType === "ADMIN" ? "매장 답글" : "캐치걸 답글"}</Chip>}
        {!isReply && <span className="text-mute">@ {c.staffName} 게시판</span>}
        {c.isHidden && <Chip tone="mute">숨김</Chip>}
        <span className="ml-auto text-[10px] text-mute">{format(new Date(c.createdAt), "MM.dd HH:mm")}</span>
      </div>
      <p className="mt-1 text-[13px] text-ink">{c.content}</p>
      {replyFor === c.id && (
        <div className="mt-2">
          <Textarea rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="매장 이름으로 답글" />
          <div className="mt-1.5 flex gap-2">
            <Button size="sm" onClick={() => act(() => adminCommentAction(slug, c.id, "reply", replyText), "답글을 남겼어요")} loading={pending}>등록</Button>
            <Button size="sm" variant="ghost" onClick={() => setReplyFor(null)}>취소</Button>
          </div>
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        {!isReply && <Button size="sm" variant="secondary" onClick={() => { setReplyFor(c.id); setReplyText(""); }}>답글</Button>}
        {c.isHidden
          ? <Button size="sm" variant="outline" onClick={() => act(() => adminCommentAction(slug, c.id, "show"), "공개했어요")} loading={pending}>공개</Button>
          : <Button size="sm" variant="ghost" onClick={() => act(() => adminCommentAction(slug, c.id, "hide"), "숨김 처리했어요")} loading={pending}>숨김</Button>}
      </div>
    </div>
  );
}
