"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Avatar, Button, Card, Chip, Empty, GradeChip, Stars, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import { addComment, reportReview, toggleFavorite, voteStaff } from "../../actions";

export type ReviewItem = { id: string; nickname: string; grade: string; rating: number; content: string; photos: string[]; reply: string | null; createdAt: string; mine: boolean };
export type CommentItem = { id: string; authorName: string; authorType: string; content: string; createdAt: string; replies: CommentItem[] };

export function ProfileClient({
  slug, staff, stats, reviews, comments, loggedIn, favorited, votes,
}: {
  slug: string;
  staff: { id: string; nickname: string; bio: string; tags: string[]; photos: string[]; hourlyPrice: number };
  stats: { rating: number | null; reviewCount: number; revisitRate: number };
  reviews: ReviewItem[];
  comments: CommentItem[];
  loggedIn: boolean;
  favorited: boolean;
  votes: { up: number; down: number; my: "UP" | "DOWN" | null };
}) {
  const [tab, setTab] = useState<0 | 1>(0);
  const [fav, setFav] = useState(favorited);
  const [vote, setVote] = useState(votes);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const requireLogin = () => {
    toast("닉네임과 PIN으로 먼저 시작해 주세요", "info");
    router.push(`/${slug}/login?next=/${slug}/bartenders/${staff.id}`);
  };

  const onFav = () => {
    if (!loggedIn) return requireLogin();
    const nextVal = !fav;
    setFav(nextVal);
    start(async () => {
      const r = await toggleFavorite(slug, staff.id);
      if (!r.ok) { setFav(!nextVal); toast(r.error, "error"); }
      else toast(nextVal ? "찜 목록에 담았어요 ♡" : "찜을 해제했어요", "success");
    });
  };

  /** 낙관적 갱신 — 같은 버튼 재클릭은 취소, 반대쪽은 갈아타기 */
  const onVote = (value: "UP" | "DOWN") => {
    if (!loggedIn) return requireLogin();
    const prev = vote;
    const my = prev.my === value ? null : value;
    const delta = (side: "UP" | "DOWN") => (my === side ? 1 : 0) - (prev.my === side ? 1 : 0);
    setVote({ up: prev.up + delta("UP"), down: prev.down + delta("DOWN"), my });
    start(async () => {
      const r = await voteStaff(slug, staff.id, value);
      if (!r.ok) { setVote(prev); toast(r.error, "error"); return; }
      toast(my === "UP" ? "추천했어요 👍" : my === "DOWN" ? "비추천했어요" : "취소했어요", "success");
      router.refresh();
    });
  };

  return (
    <div className="flex-1 animate-fade">
      {/* 사진 갤러리 */}
      <div className="no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 pt-4">
        {(staff.photos.length ? staff.photos : [null, null, null]).slice(0, 10).map((p, i) => (
          <div key={i} className="flex h-[224px] min-w-[176px] snap-center items-center justify-center overflow-hidden rounded-[22px] border border-line bg-blush-lt">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p ? <img src={p} alt="" className="h-full w-full object-cover" style={{ mixBlendMode: p.startsWith("/assets/") ? "multiply" : undefined }} /> : <span className="font-serif text-3xl text-brand">{staff.nickname[0]}</span>}
          </div>
        ))}
      </div>

      <div className="px-[22px] pb-6 pt-[18px]">
        <div className="flex flex-wrap gap-1.5">
          {staff.tags.map((t) => (
            <Chip key={t}>#{t}</Chip>
          ))}
        </div>
        <div className="mt-3.5 flex items-center justify-between">
          <div>
            <div className="font-serif text-[24px] font-bold text-ink">{staff.nickname}</div>
            <div className="mt-0.5 text-[13px] font-semibold text-brand">
              {staff.hourlyPrice.toLocaleString("ko-KR")}원<span className="text-[11px] font-medium text-mute"> / 1시간</span>
            </div>
          </div>
          <button
            onClick={onFav}
            disabled={pending}
            aria-label="찜하기"
            className={cn("flex h-10 w-10 items-center justify-center rounded-full border text-[18px] transition-all active:scale-90", fav ? "border-brand bg-blush-lt text-brand" : "border-line bg-white text-blush")}
          >
            {fav ? "♥" : "♡"}
          </button>
        </div>
        <p className="mt-2 text-[13px] leading-[1.85] text-mute">{staff.bio}</p>

        <div className="mt-5 flex rounded-[20px] border border-line bg-white py-4">
          {[
            ["평점", stats.rating !== null ? stats.rating.toFixed(1) : "–"],
            ["후기", String(stats.reviewCount)],
            ["추천", String(vote.up)],
            ["재방문", `${stats.revisitRate}%`],
          ].map(([k, v], i) => (
            <div key={k} className={cn("flex-1 text-center", i > 0 && "border-l border-line")}>
              <div className="font-serif text-[19px] font-bold text-brand">{v}</div>
              <div className="mt-1 text-[10px] font-medium text-mute">{k}</div>
            </div>
          ))}
        </div>

        {/* 추천 / 비추천 */}
        <div className="mt-3 flex gap-2.5">
          <button
            onClick={() => onVote("UP")}
            disabled={pending}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border text-[13px] font-bold transition-all active:scale-[.97]",
              vote.my === "UP" ? "border-brand bg-blush-lt text-brand" : "border-line bg-white text-mute",
            )}
          >
            👍 추천 <span className="font-serif">{vote.up}</span>
          </button>
          <button
            onClick={() => onVote("DOWN")}
            disabled={pending}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border text-[13px] font-bold transition-all active:scale-[.97]",
              vote.my === "DOWN" ? "border-ink bg-[#F1ECED] text-ink" : "border-line bg-white text-mute",
            )}
          >
            👎 비추천 <span className="font-serif">{vote.down}</span>
          </button>
        </div>
        <div className="mt-1.5 text-center text-[10px] text-mute">
          {vote.my ? "같은 버튼을 다시 누르면 취소돼요" : "한 캐치걸에 한 표만 줄 수 있어요"}
        </div>

        {/* 탭 */}
        <div className="mt-6 flex gap-5 border-b border-line">
          {[`후기 ${reviews.length}`, `댓글 ${comments.reduce((a, c) => a + 1 + c.replies.length, 0)}`].map((l, i) => (
            <button
              key={l}
              onClick={() => setTab(i as 0 | 1)}
              className={cn("-mb-px pb-2.5 text-[13px] font-bold transition-colors", tab === i ? "border-b-2 border-brand text-ink" : "border-b-2 border-transparent text-mute")}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === 0 ? (
          <ReviewsTab slug={slug} reviews={reviews} loggedIn={loggedIn} requireLogin={requireLogin} />
        ) : (
          <CommentsTab slug={slug} staffId={staff.id} staffName={staff.nickname} comments={comments} loggedIn={loggedIn} requireLogin={requireLogin} />
        )}
      </div>
    </div>
  );
}

function ReviewsTab({ slug, reviews, loggedIn, requireLogin }: { slug: string; reviews: ReviewItem[]; loggedIn: boolean; requireLogin: () => void }) {
  const { toast } = useToast();
  if (!reviews.length) return <Empty sticker="p6" title="아직 후기가 없어요" desc="방문을 완료한 분만 후기를 남길 수 있어요" />;
  return (
    <div className="mt-1">
      {reviews.map((r) => (
        <Card key={r.id} className="mt-[18px] p-4 shadow-none">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-ink">{r.nickname}</span>
            <GradeChip grade={r.grade} />
            <span className="ml-auto"><Stars value={r.rating} size={11} /></span>
          </div>
          <p className="mt-2 text-[13px] leading-[1.75] text-mute">{r.content}</p>
          {r.photos.length > 0 && (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
              {r.photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-line object-cover" />
              ))}
            </div>
          )}
          {r.reply && (
            <div className="mt-3 rounded-2xl bg-blush-lt px-3.5 py-3">
              <div className="text-[10px] font-bold text-brand">캐치걸 답글</div>
              <p className="mt-1 text-[12px] leading-[1.7] text-ink">{r.reply}</p>
            </div>
          )}
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-mute/80">
            <span>{format(new Date(r.createdAt), "yyyy.MM.dd")}</span>
            {!r.mine && (
              <button
                className="underline-offset-2 hover:underline"
                onClick={async () => {
                  if (!loggedIn) return requireLogin();
                  const res = await reportReview(slug, r.id, "부적절한 내용");
                  toast(res.ok ? "신고가 접수됐어요. 관리자가 검토할게요." : res.error, res.ok ? "success" : "error");
                }}
              >
                신고
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function CommentsTab({ slug, staffId, staffName, comments, loggedIn, requireLogin }: { slug: string; staffId: string; staffName: string; comments: CommentItem[]; loggedIn: boolean; requireLogin: () => void }) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const submit = () => {
    if (!loggedIn) return requireLogin();
    if (!text.trim()) return;
    start(async () => {
      const r = await addComment(slug, staffId, text, replyTo ?? undefined);
      if (!r.ok) return toast(r.error, "error");
      setText(""); setReplyTo(null);
      toast("댓글을 남겼어요", "success");
      router.refresh();
    });
  };

  return (
    <div className="mt-4">
      <div className="rounded-2xl border border-line bg-white p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between text-[11px] text-brand">
            <span>답글 작성 중</span>
            <button onClick={() => setReplyTo(null)} className="text-mute">취소</button>
          </div>
        )}
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={loggedIn ? `${staffName}에게 궁금한 점을 남겨보세요` : "로그인 후 댓글을 남길 수 있어요"} className="border-0 p-1 focus:ring-0" />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} loading={pending} disabled={!text.trim()}>등록</Button>
        </div>
      </div>
      {!comments.length ? (
        <Empty sticker="p2" title="첫 댓글을 남겨볼까요" desc="캐치걸가 직접 답글을 달아드려요" />
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id}>
              <CommentRow c={c} onReply={() => setReplyTo(c.id)} />
              {c.replies.map((r) => (
                <div key={r.id} className="ml-8 mt-2">
                  <CommentRow c={r} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentRow({ c, onReply }: { c: CommentItem; onReply?: () => void }) {
  const isStaff = c.authorType !== "CUSTOMER";
  return (
    <div className={cn("flex gap-2.5 rounded-2xl p-3", isStaff ? "bg-blush-lt" : "border border-line bg-white")}>
      <Avatar name={c.authorName} size={30} rounded={10} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-ink">{c.authorName}</span>
          {isStaff && <Chip>{c.authorType === "ADMIN" ? "매장" : "캐치걸"}</Chip>}
          <span className="ml-auto text-[10px] text-mute/80">{format(new Date(c.createdAt), "MM.dd HH:mm")}</span>
        </div>
        <p className="mt-1 text-[12px] leading-[1.7] text-ink/90">{c.content}</p>
        {onReply && (
          <button onClick={onReply} className="mt-1 text-[10px] font-semibold text-mute">답글 달기</button>
        )}
      </div>
    </div>
  );
}
