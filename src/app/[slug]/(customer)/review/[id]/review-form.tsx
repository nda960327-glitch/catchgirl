"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { uploadImages } from "@/lib/image-client";
import { cn } from "@/lib/utils";
import { submitReview } from "../../actions";

export function ReviewForm({ slug, reservationId }: { slug: string; reservationId: string }) {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const list = Array.from(files).slice(0, 5 - photos.length);
      const up = await uploadImages(list);
      setPhotos((p) => [...p, ...up.map((u) => u.url)]);
    } catch {
      toast("사진 업로드에 실패했어요", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = () => {
    start(async () => {
      const r = await submitReview(slug, { reservationId, rating, content, photos });
      if (!r.ok) return toast(r.error, "error");
      toast("후기를 남겼어요. 고마워요 ♡", "success");
      router.push(`/${slug}/me`);
    });
  };

  const labels = ["", "아쉬웠어요", "그저 그랬어요", "괜찮았어요", "좋았어요", "최고였어요"];
  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-6">
      <div className="rounded-[20px] border border-line bg-card p-5 text-center">
        <div className="text-[12px] text-mute">오늘의 시간은 어땠나요</div>
        <div className="mt-2 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} onClick={() => setRating(i)} className={cn("text-[30px] transition-transform active:scale-90", i <= rating ? "text-brand" : "text-line")} aria-label={`${i}점`}>★</button>
          ))}
        </div>
        <div className="mt-1 text-[12px] font-semibold text-brand">{labels[rating]}</div>
      </div>
      <Field label="후기" hint={`${content.length}/500`}>
        <Textarea rows={5} maxLength={500} value={content} onChange={(e) => setContent(e.target.value)} placeholder="어떤 대화가 오갔는지, 어떤 점이 좋았는지 — 다음 사람에게 힌트가 되어줄 거예요." />
      </Field>
      <Field label="사진" hint="최대 5장 · 자동 리사이즈">
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={p} className="relative h-[72px] w-[72px] overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="h-full w-full object-cover" />
              <button onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] text-white">✕</button>
            </div>
          ))}
          {photos.length < 5 && (
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-xl border border-dashed border-blush bg-card text-mute">
              <span className="text-lg">{uploading ? "…" : "＋"}</span>
              <span className="text-[9px]">{uploading ? "업로드 중" : "사진 추가"}</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </div>
      </Field>
      <div className="mt-auto">
        <Button size="lg" onClick={submit} loading={pending} disabled={content.trim().length < 5 || uploading}>후기 등록</Button>
      </div>
    </div>
  );
}
