"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, Chip, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { uploadImages } from "@/lib/image-client";
import { cn } from "@/lib/utils";
import { BUST_SIZES } from "@/lib/profile";
import { deleteStaff, saveStaff, staffDeletionImpact } from "../../actions";

export type StaffFull = {
  id: string; nickname: string; bio: string; tags: string[]; photos: string[]; isActive: boolean; capacityPerSlot: number; hourlyPrice: number; adminMemo: string; loginId: string;
  heightCm: number | null; weightKg: number | null; bustSize: string; bustNatural: boolean; smoker: boolean; tattoo: boolean; tattooNote: string;
  optionIds: string[];
  stats: {
    rating: number | null; reviewCount: number; reservationCount: number; completedCount: number; noshowRate: number; revisitRate: number;
    upCount: number; downCount: number; customerCount: number; repeatCustomers: number; newCustomers30d: number;
  };
};
export type StoreOptionLite = { id: string; name: string; price: number };

const EMPTY: StaffFull = {
  id: "", nickname: "", bio: "", tags: [], photos: [], isActive: true, capacityPerSlot: 1, hourlyPrice: 300000, adminMemo: "", loginId: "",
  heightCm: null, weightKg: null, bustSize: "", bustNatural: false, smoker: false, tattoo: false, tattooNote: "", optionIds: [],
  stats: { rating: null, reviewCount: 0, reservationCount: 0, completedCount: 0, noshowRate: 0, revisitRate: 0, upCount: 0, downCount: 0, customerCount: 0, repeatCustomers: 0, newCustomers30d: 0 },
};

export function StaffManager({ slug, items, storeOptions, initialEdit }: { slug: string; items: StaffFull[]; storeOptions: StoreOptionLite[]; initialEdit?: string }) {
  const [editing, setEditing] = useState<StaffFull | null>(initialEdit === "new" ? EMPTY : items.find((i) => i.id === initialEdit) ?? null);
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_440px]">
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditing(EMPTY)}>+ 캐치걸 등록</Button>
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
                {/* 손님이 보는 값들 — 여기서도 한눈에 확인하고 바로 고칠 수 있게 */}
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                  {s.heightCm && <span className="rounded-md bg-[#F6F1F2] px-1.5 py-0.5 font-semibold text-ink">{s.heightCm}cm</span>}
                  {s.weightKg && <span className="rounded-md bg-[#F6F1F2] px-1.5 py-0.5 font-semibold text-ink">{s.weightKg}kg</span>}
                  {s.bustSize && (
                    <span className="rounded-md bg-[#F6F1F2] px-1.5 py-0.5 font-semibold text-ink">
                      {s.bustSize}컵{s.bustNatural && <span className="text-brand"> 자연</span>}
                    </span>
                  )}
                  <span className={cn("rounded-md px-1.5 py-0.5 font-semibold", s.smoker ? "bg-[#FDECEC] text-[#C0392B]" : "bg-[#E8F6EE] text-[#2E8B57]")}>
                    {s.smoker ? "흡연" : "비흡연"}
                  </span>
                  <span className={cn("rounded-md px-1.5 py-0.5 font-semibold", s.tattoo ? "bg-[#F6F1F2] text-mute" : "bg-[#E8F6EE] text-[#2E8B57]")}>
                    {s.tattoo ? `문신 ${s.tattooNote || "있음"}` : "문신 없음"}
                  </span>
                  {storeOptions.filter((o) => s.optionIds.includes(o.id)).map((o) => (
                    <span key={o.id} className="rounded-md bg-blush-lt px-1.5 py-0.5 font-semibold text-brand">{o.name}</span>
                  ))}
                </div>
                {s.adminMemo && <div className="mt-1 truncate text-[10px] text-mute" title={s.adminMemo}>📝 {s.adminMemo}</div>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(s)}>수정</Button>
            </div>
            {/* 실적 */}
            <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl bg-[#FAF6F7] p-3 text-center md:grid-cols-8">
              {[
                ["예약 수", `${s.stats.reservationCount}`],
                ["방문완료", `${s.stats.completedCount}`],
                ["손님 수", `${s.stats.customerCount}명`],
                ["재방문", `${s.stats.repeatCustomers}명 · ${s.stats.revisitRate}%`],
                ["신규(30일)", `${s.stats.newCustomers30d}명`],
                ["평균 별점", s.stats.rating !== null ? `${s.stats.rating.toFixed(1)} (${s.stats.reviewCount})` : "–"],
                ["노쇼율", `${s.stats.noshowRate}%`],
                ["👍 / 👎", `${s.stats.upCount} / ${s.stats.downCount}`],
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
        {editing ? <StaffEditor key={editing.id || "new"} slug={slug} init={editing} storeOptions={storeOptions} onClose={() => setEditing(null)} /> : (
          <Card className="flex h-48 items-center justify-center p-6 text-center text-[12px] text-mute">캐치걸를 선택하면 여기서 수정할 수 있어요</Card>
        )}
      </div>
    </div>
  );
}

function StaffEditor({ slug, init, storeOptions, onClose }: { slug: string; init: StaffFull; storeOptions: StoreOptionLite[]; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ ...init, password: "", tagInput: "" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
        capacityPerSlot: f.capacityPerSlot, hourlyPrice: f.hourlyPrice, adminMemo: f.adminMemo, optionIds: f.optionIds,
        heightCm: f.heightCm, weightKg: f.weightKg, bustSize: f.bustSize, bustNatural: f.bustNatural,
        smoker: f.smoker, tattoo: f.tattoo, tattooNote: f.tattooNote,
        loginId: f.loginId, password: f.password,
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="닉네임 (고객 노출)" hint="실명은 저장하지 않아요"><Input value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} /></Field>
          <Field label="시간당 요금" hint={`${f.hourlyPrice.toLocaleString("ko-KR")}원`}>
            <Input type="number" min={0} step={10000} value={f.hourlyPrice} onChange={(e) => setF({ ...f, hourlyPrice: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="한 줄 소개"><Textarea rows={2} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>

        {/* 프로필 — 손님이 고를 때 실제로 보는 값들. 모르는 건 비워 두면 화면에 안 나온다. */}
        <div className="rounded-2xl border border-line bg-white p-3.5">
          <div className="text-[12px] font-bold text-ink">프로필</div>
          <div className="mt-0.5 text-[10px] leading-[1.7] text-mute">손님이 고를 때 보는 값이에요. 비워 두면 그 항목은 화면에 안 나와요.</div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="키" hint="cm">
              <Input type="number" min={120} max={220} value={f.heightCm ?? ""} onChange={(e) => setF({ ...f, heightCm: e.target.value ? Number(e.target.value) : null })} className="h-11" />
            </Field>
            <Field label="몸무게" hint="kg">
              <Input type="number" min={30} max={200} value={f.weightKg ?? ""} onChange={(e) => setF({ ...f, weightKg: e.target.value ? Number(e.target.value) : null })} className="h-11" />
            </Field>
            <Field label="가슴">
              <Select value={f.bustSize} onChange={(e) => setF({ ...f, bustSize: e.target.value })} className="w-full">
                <option value="">미기재</option>
                {BUST_SIZES.map((b) => <option key={b} value={b}>{b}컵</option>)}
              </Select>
            </Field>
            <label className="flex items-end gap-1.5 pb-2.5 text-[12px] font-semibold text-mute">
              <input type="checkbox" checked={f.bustNatural} disabled={!f.bustSize} onChange={(e) => setF({ ...f, bustNatural: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
              자연
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-mute">
              <input type="checkbox" checked={f.smoker} onChange={(e) => setF({ ...f, smoker: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
              흡연
            </label>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-mute">
              <input type="checkbox" checked={f.tattoo} onChange={(e) => setF({ ...f, tattoo: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
              문신
            </label>
            {f.tattoo && (
              <Input value={f.tattooNote} onChange={(e) => setF({ ...f, tattooNote: e.target.value })} placeholder="위치·크기 (예: 손목 작게)" maxLength={60} className="h-10 w-[220px] text-[12px]" />
            )}
          </div>
        </div>

        {/* 제공 옵션 — 캐치걸 본인도 '내 설정'에서 바꿀 수 있다 */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[12px] font-semibold text-ink">제공 옵션</span>
            <span className="text-[11px] text-mute">고르지 않으면 예약 화면에 안 뜸</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {storeOptions.length === 0 && <span className="text-[12px] text-mute">매장에 등록된 옵션이 없어요</span>}
            {storeOptions.map((o) => {
              const on = f.optionIds.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setF({ ...f, optionIds: on ? f.optionIds.filter((x) => x !== o.id) : [...f.optionIds, o.id] })}
                  className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors", on ? "bg-brand text-white" : "bg-[#F4EDEE] text-mute")}
                >
                  {o.name} +{o.price.toLocaleString("ko-KR")}원
                </button>
              );
            })}
          </div>
        </div>

        <Field label="관리자 메모" hint="캐치걸에겐 안 보임">
          <Textarea rows={2} value={f.adminMemo} onChange={(e) => setF({ ...f, adminMemo: e.target.value })} placeholder="예: 지명 많음. 주말 야간 고정 선호" />
        </Field>
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

        {/* 근무일은 출근 배치가 곧 근무표다 — 여기서 따로 짜면 기준이 둘이 되어 어긋난다 */}
        <div className="rounded-2xl bg-[#FAF6F7] px-4 py-3 text-[11px] leading-[1.7] text-mute">
          근무일과 시간대는 <Link href={`/${slug}/admin/staff/schedule`} className="font-bold text-brand">출근 · 룸 배치</Link>에서 정해요.
          <br />배치된 날의 배치된 조(주간/야간)에만 손님이 예약할 수 있어요.
        </div>

        <Button size="lg" onClick={submit} loading={pending} disabled={!f.nickname.trim() || uploading}>{f.id ? "저장" : "등록"}</Button>
        {f.id && <DeleteStaffButton slug={slug} staffId={f.id} onDeleted={onClose} />}
      </div>
    </Card>
  );
}

/** 삭제는 예약·후기까지 함께 지우므로, 무엇이 사라지는지 먼저 보여주고 확인받는다 */
function DeleteStaffButton({ slug, staffId, onDeleted }: { slug: string; staffId: string; onDeleted: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const onClick = () => {
    start(async () => {
      const impact = await staffDeletionImpact(slug, staffId);
      if (!impact.ok) return toast(impact.error, "error");
      const { nickname, reservations, reviews } = impact.data!;
      const lines = [
        `${nickname} 캐치걸를 삭제할까요?`,
        "",
        reservations || reviews
          ? `예약 ${reservations}건과 후기 ${reviews}건이 함께 영구 삭제됩니다. 매출 이력도 사라져요.`
          : "삭제할 예약·후기 이력은 없어요.",
        "",
        "잠시 출근을 안 하는 것뿐이라면 '활성' 체크를 해제하는 편이 낫습니다.",
      ];
      if (!confirm(lines.join("\n"))) return;
      const r = await deleteStaff(slug, staffId);
      if (!r.ok) return toast(r.error, "error");
      toast(`${nickname} 캐치걸를 삭제했어요`, "success");
      onDeleted();
      router.refresh();
    });
  };

  return (
    <button onClick={onClick} disabled={pending} className="h-11 rounded-2xl border border-[#E8C7C7] bg-white text-[13px] font-bold text-[#C0392B] transition-colors hover:bg-[#FDECEC] disabled:opacity-50">
      {pending ? "확인 중…" : "캐치걸 삭제"}
    </button>
  );
}
