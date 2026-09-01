"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, Chip, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { uploadImages } from "@/lib/image-client";
import { cn, WEEKDAYS_KO } from "@/lib/utils";
import { saveStaff } from "../../actions";

export type StaffFull = {
  id: string; nickname: string; bio: string; tags: string[]; photos: string[]; isActive: boolean; capacityPerSlot: number; loginId: string;
  schedules: { weekday: number; startTime: string; endTime: string }[];
  offs: { date: string; reason: string }[];
  stats: { rating: number | null; reviewCount: number; reservationCount: number; completedCount: number; noshowRate: number; revisitRate: number };
};

const EMPTY: StaffFull = { id: "", nickname: "", bio: "", tags: [], photos: [], isActive: true, capacityPerSlot: 1, loginId: "", schedules: [], offs: [], stats: { rating: null, reviewCount: 0, reservationCount: 0, completedCount: 0, noshowRate: 0, revisitRate: 0 } };

export function StaffManager({ slug, items, storeHours, initialEdit }: { slug: string; items: StaffFull[]; storeHours: { open: string; close: string }; initialEdit?: string }) {
  const [editing, setEditing] = useState<StaffFull | null>(initialEdit === "new" ? EMPTY : items.find((i) => i.id === initialEdit) ?? null);
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_440px]">
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditing({ ...EMPTY, schedules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: storeHours.open, endTime: storeHours.close })) })}>+ 캐치걸 등록</Button>
        </div>
        {items.map((s) => (
          <Card key={s.id} className={cn("p-4", editing?.id === s.id && "border-brand")}>
            <div className="flex items-start gap-3">
              <Avatar src={s.photos[0]} name={s.nickname} size={56} rounded={18} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-[16px] font-bold text-ink">{s.nickname}</span>
                  <Chip tone={s.isActive ? "green" : "mute"}>{s.isActive ? "활성" : "비활성"}</Chip>
                  {s.loginId && <Chip tone="gold">ID {s.loginId}</Chip>}
                  <Chip tone="mute">슬롯당 {s.capacityPerSlot}팀</Chip>
                </div>
                <div className="mt-1 truncate text-[11px] text-mute">{s.tags.map((t) => `#${t}`).join(" ") || "태그 없음"}</div>
                <div className="mt-1 text-[10px] text-mute">
                  근무: {s.schedules.length ? s.schedules.map((x) => WEEKDAYS_KO[x.weekday]).join("·") : "없음"} {s.schedules[0] ? `${s.schedules[0].startTime}–${s.schedules[0].endTime}` : ""}
                  {s.offs.length > 0 && ` · 휴무 ${s.offs.length}일`}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(s)}>수정</Button>
            </div>
            {/* 실적 */}
            <div className="mt-3 grid grid-cols-5 gap-2 rounded-2xl bg-[#FAF6F7] p-3 text-center">
              {[
                ["예약 수", `${s.stats.reservationCount}`],
                ["방문완료", `${s.stats.completedCount}`],
                ["재방문 유도율", `${s.stats.revisitRate}%`],
                ["평균 별점", s.stats.rating !== null ? `${s.stats.rating.toFixed(1)} (${s.stats.reviewCount})` : "–"],
                ["노쇼율", `${s.stats.noshowRate}%`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="font-serif text-[15px] font-bold text-brand">{v}</div>
                  <div className="mt-0.5 text-[9px] text-mute">{k}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="xl:sticky xl:top-6 xl:self-start">
        {editing ? <StaffEditor key={editing.id || "new"} slug={slug} init={editing} onClose={() => setEditing(null)} /> : (
          <Card className="flex h-48 items-center justify-center p-6 text-center text-[12px] text-mute">캐치걸를 선택하면 여기서 수정할 수 있어요</Card>
        )}
      </div>
    </div>
  );
}

function StaffEditor({ slug, init, onClose }: { slug: string; init: StaffFull; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ ...init, password: "", tagInput: "" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleDay = (wd: number) => {
    const has = f.schedules.some((s) => s.weekday === wd);
    const tpl = f.schedules[0] ?? { startTime: "15:00", endTime: "23:00" };
    setF({ ...f, schedules: has ? f.schedules.filter((s) => s.weekday !== wd) : [...f.schedules, { weekday: wd, startTime: tpl.startTime, endTime: tpl.endTime }].sort((a, b) => a.weekday - b.weekday) });
  };
  const setSched = (wd: number, k: "startTime" | "endTime", v: string) => setF({ ...f, schedules: f.schedules.map((s) => (s.weekday === wd ? { ...s, [k]: v } : s)) });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const up = await uploadImages(Array.from(files).slice(0, 10 - f.photos.length));
      setF((x) => ({ ...x, photos: [...x.photos, ...up.map((u) => u.url)] }));
    } catch { toast("업로드 실패", "error"); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const submit = () => {
    start(async () => {
      const r = await saveStaff(slug, {
        id: f.id || undefined, nickname: f.nickname, bio: f.bio, tags: f.tags, photos: f.photos, isActive: f.isActive,
        capacityPerSlot: f.capacityPerSlot, loginId: f.loginId, password: f.password, schedules: f.schedules, offs: f.offs,
      });
      if (!r.ok) return toast(r.error, "error");
      toast("저장했어요", "success");
      router.refresh();
      if (!f.id) onClose();
    });
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="font-serif text-[17px] font-bold text-ink">{f.id ? `${init.nickname} 수정` : "새 캐치걸"}</div>
        <button onClick={onClose} className="h-8 w-8 rounded-full border border-line bg-white text-mute">✕</button>
      </div>
      <div className="mt-4 flex flex-col gap-3.5">
        {/* 사진 */}
        <Field label="프로필 사진" hint={`${f.photos.length}/10 · 첫 장이 대표`}>
          <div className="flex flex-wrap gap-2">
            {f.photos.map((p, i) => (
              <div key={p + i} className="relative h-16 w-16 overflow-hidden rounded-xl border border-line bg-blush-lt">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="h-full w-full object-cover" />
                <button onClick={() => setF({ ...f, photos: f.photos.filter((_, j) => j !== i) })} className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-black/50 text-[10px] text-white">✕</button>
                {i > 0 && <button onClick={() => setF({ ...f, photos: [p, ...f.photos.filter((_, j) => j !== i)] })} className="absolute bottom-0.5 left-0.5 rounded bg-white/90 px-1 text-[8px] font-bold text-brand">대표</button>}
              </div>
            ))}
            {f.photos.length < 10 && (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-dashed border-blush bg-white text-[10px] text-mute">
                {uploading ? "…" : "＋ 추가"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          </div>
        </Field>
        <Field label="닉네임 (고객 노출)" hint="실명은 저장하지 않아요"><Input value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} /></Field>
        <Field label="한 줄 소개"><Textarea rows={2} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <Field label="태그" hint="Enter로 추가">
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-white px-3 py-2">
            {f.tags.map((t) => (
              <button key={t} onClick={() => setF({ ...f, tags: f.tags.filter((x) => x !== t) })} className="rounded-full bg-blush-lt px-2.5 py-1 text-[11px] font-bold text-brand">#{t} ✕</button>
            ))}
            <input
              value={f.tagInput}
              onChange={(e) => setF({ ...f, tagInput: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && f.tagInput.trim()) { e.preventDefault(); const t = f.tagInput.trim().replace(/^#/, ""); if (!f.tags.includes(t) && f.tags.length < 8) setF({ ...f, tags: [...f.tags, t], tagInput: "" }); else setF({ ...f, tagInput: "" }); }
              }}
              placeholder="상냥함"
              className="min-w-[80px] flex-1 bg-transparent py-1 text-[12px] outline-none"
            />
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="동시 접객 (팀/슬롯)"><Input type="number" min={1} max={10} value={f.capacityPerSlot} onChange={(e) => setF({ ...f, capacityPerSlot: Number(e.target.value) })} className="h-11" /></Field>
          <Field label="로그인 ID"><Input value={f.loginId} onChange={(e) => setF({ ...f, loginId: e.target.value })} placeholder="junhee" className="h-11" /></Field>
          <Field label="비밀번호" hint={f.id ? "변경 시만" : ""}><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="h-11" /></Field>
        </div>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="h-4 w-4 accent-[var(--brand)]" /> 활성 (고객 화면에 노출)
        </label>

        {/* 근무 스케줄 */}
        <Field label="요일별 근무 시간">
          <div className="flex gap-1">
            {WEEKDAYS_KO.map((d, wd) => {
              const on = f.schedules.some((s) => s.weekday === wd);
              return <button key={d} onClick={() => toggleDay(wd)} className={cn("h-9 flex-1 rounded-xl text-[12px] font-bold", on ? "bg-brand text-white" : "border border-line bg-white text-mute")}>{d}</button>;
            })}
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {f.schedules.map((s) => (
              <div key={s.weekday} className="flex items-center gap-2 text-[12px]">
                <span className="w-6 font-bold text-ink">{WEEKDAYS_KO[s.weekday]}</span>
                <Input type="time" value={s.startTime} onChange={(e) => setSched(s.weekday, "startTime", e.target.value)} className="h-9 w-[110px] text-[12px]" />
                <span className="text-mute">–</span>
                <Input type="time" value={s.endTime} onChange={(e) => setSched(s.weekday, "endTime", e.target.value)} className="h-9 w-[110px] text-[12px]" />
              </div>
            ))}
          </div>
        </Field>

        {/* 특정일 휴무 */}
        <Field label="특정일 휴무">
          <div className="flex flex-col gap-1.5">
            {f.offs.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input type="date" value={o.date} onChange={(e) => setF({ ...f, offs: f.offs.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} className="h-9 w-[150px] text-[12px]" />
                <Input value={o.reason} onChange={(e) => setF({ ...f, offs: f.offs.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)) })} placeholder="사유" className="h-9 flex-1 text-[12px]" />
                <button onClick={() => setF({ ...f, offs: f.offs.filter((_, j) => j !== i) })} className="text-[12px] text-mute">✕</button>
              </div>
            ))}
            <button onClick={() => setF({ ...f, offs: [...f.offs, { date: "", reason: "" }] })} className="self-start text-[11px] font-bold text-brand">+ 휴무일 추가</button>
          </div>
        </Field>
        <Button size="lg" onClick={submit} loading={pending} disabled={!f.nickname.trim() || uploading}>{f.id ? "저장" : "등록"}</Button>
      </div>
    </Card>
  );
}
