"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { uploadImages } from "@/lib/image-client";
import { cn, WEEKDAYS_KO } from "@/lib/utils";
import { THEMES, themeStyle, type ThemeKey } from "@/lib/themes";
import { saveStoreSettings, triggerReminders } from "../../actions";

type Init = { name: string; tagline: string; heroTitle: string; logoUrl: string | null; coverUrl: string | null; themeColor: string; openTime: string; closeTime: string; shiftSplitTime: string; slotMinutes: number; closedDays: number[]; cancelDeadlineHours: number; maxAdvanceDays: number; noshowPolicy: string; contactPhone: string; contactTelegram: string; theme: ThemeKey };

const PRESETS = ["#B4586A", "#C8A46A", "#5B6C8F", "#3E7C6A", "#8A5BB5", "#C4642F", "#1F1F24"];

export function SettingsForm({ slug, init }: { slug: string; init: Init }) {
  const [f, setF] = useState(init);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const upload = async (kind: "logo" | "cover", files: FileList | null) => {
    if (!files?.[0]) return;
    setUploading(kind);
    try {
      const [u] = await uploadImages([files[0]]);
      setF((x) => (kind === "logo" ? { ...x, logoUrl: u.url } : { ...x, coverUrl: u.url }));
    } catch (e) { toast(e instanceof Error ? e.message : "업로드에 실패했어요.", "error"); } finally { setUploading(null); }
  };

  const submit = () =>
    start(async () => {
      const r = await saveStoreSettings(slug, f);
      toast(r.ok ? "저장했어요. 고객 화면에 바로 반영돼요." : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-5">
        <Card className="p-5">
          <div className="text-[14px] font-bold text-ink">브랜딩</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="매장명"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="태그라인"><Input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} placeholder="오늘 밤, 당신의 캐치걸" /></Field>
            <Field label="홈 상단 문구" hint="{'{n}'} = 오늘 가능한 캐치걸 수 · 줄바꿈 그대로">
              <Textarea
                rows={2}
                value={f.heroTitle}
                onChange={(e) => setF({ ...f, heroTitle: e.target.value })}
                placeholder={"오늘 자리를 지키는\n{n} 사람"}
              />
            </Field>
            <Field label="로고">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.logoUrl ? <img src={f.logoUrl} alt="" className="h-14 w-14 rounded-2xl border border-line object-cover" /> : <div className="h-14 w-14 rounded-2xl border border-dashed border-line" />}
                <Button size="sm" variant="outline" onClick={() => logoRef.current?.click()} loading={uploading === "logo"}>업로드</Button>
                {f.logoUrl && <button onClick={() => setF({ ...f, logoUrl: null })} className="text-[11px] text-mute">제거</button>}
                <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => upload("logo", e.target.files)} />
              </div>
            </Field>
            <Field label="커버 이미지">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.coverUrl ? <img src={f.coverUrl} alt="" className="h-14 w-24 rounded-2xl border border-line object-cover" /> : <div className="h-14 w-24 rounded-2xl border border-dashed border-line" />}
                <Button size="sm" variant="outline" onClick={() => coverRef.current?.click()} loading={uploading === "cover"}>업로드</Button>
                {f.coverUrl && <button onClick={() => setF({ ...f, coverUrl: null })} className="text-[11px] text-mute">제거</button>}
                <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => upload("cover", e.target.files)} />
              </div>
            </Field>
            <Field label="화면 테마" hint="어두운 테마도 있어요 · 메인 컬러는 따로 고를 수 있어요">
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(THEMES) as ThemeKey[]).map((k) => {
                  const t = THEMES[k];
                  const on = f.theme === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setF({ ...f, theme: k, themeColor: t.brand })}
                      aria-pressed={on}
                      title={t.desc}
                      className={cn("overflow-hidden rounded-xl border-2 text-left transition-colors", on ? "border-brand" : "border-line hover:border-mute")}
                    >
                      <span className="block h-9 w-full" style={{ background: `linear-gradient(135deg, ${t.paper} 55%, ${t.brand} 55%)` }} />
                      <span className="block px-1.5 py-1 text-[10px] font-bold" style={{ background: t.card, color: t.ink }}>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="메인 컬러">
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((c) => (
                  <button key={c} onClick={() => setF({ ...f, themeColor: c })} className={cn("h-8 w-8 rounded-full border-2", f.themeColor.toLowerCase() === c.toLowerCase() ? "border-ink" : "border-card")} style={{ background: c }} aria-label={c} />
                ))}
                <input type="color" value={f.themeColor} onChange={(e) => setF({ ...f, themeColor: e.target.value })} className="h-8 w-10 cursor-pointer rounded-lg border border-line bg-card" />
                <Input value={f.themeColor} onChange={(e) => setF({ ...f, themeColor: e.target.value })} className="h-9 w-[110px] text-[12px]" />
              </div>
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[14px] font-bold text-ink">영업 · 예약 정책</div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {/* 오픈·마감은 아래 '주간 · 야간 시간'에서 조 시간과 함께 정한다 */}
            <Field label="슬롯 단위">
              <Select value={String(f.slotMinutes)} onChange={(e) => setF({ ...f, slotMinutes: Number(e.target.value) })} className="w-full">
                <option value="30">30분</option>
                <option value="60">60분</option>
              </Select>
            </Field>
            <Field label="예약 가능 기간"><div className="flex items-center gap-2"><Input type="number" min={1} max={90} value={f.maxAdvanceDays} onChange={(e) => setF({ ...f, maxAdvanceDays: Number(e.target.value) })} className="h-11" /><span className="shrink-0 text-[12px] text-mute">일 후까지</span></div></Field>
            <Field label="취소 마감"><div className="flex items-center gap-2"><span className="shrink-0 text-[12px] text-mute">방문</span><Input type="number" min={0} max={72} value={f.cancelDeadlineHours} onChange={(e) => setF({ ...f, cancelDeadlineHours: Number(e.target.value) })} className="h-11" /><span className="shrink-0 text-[12px] text-mute">시간 전까지</span></div></Field>
            <Field label="정기 휴무일">
              <div className="flex gap-1">
                {WEEKDAYS_KO.map((d, wd) => {
                  const on = f.closedDays.includes(wd);
                  return <button key={d} onClick={() => setF({ ...f, closedDays: on ? f.closedDays.filter((x) => x !== wd) : [...f.closedDays, wd].sort() })} className={cn("h-9 flex-1 rounded-lg text-[12px] font-bold", on ? "bg-ink text-on-ink" : "border border-line bg-card text-mute")}>{d}</button>;
                })}
              </div>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="노쇼 정책 문구 (고객 화면 노출)"><Textarea rows={2} value={f.noshowPolicy} onChange={(e) => setF({ ...f, noshowPolicy: e.target.value })} /></Field>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[14px] font-bold text-ink">문의 창구</div>
          <div className="mt-1 text-[11px] leading-[1.7] text-mute">
            손님 화면 오른쪽 아래 <b className="text-ink">문의</b> 버튼에 들어가요. 누르면 텔레그램 대화나 전화로 바로 이어져요.
            비워 두면 버튼이 나오지 않아요.
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="문의 전화번호" hint="누르면 바로 걸려요">
              <Input value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} placeholder="010-0000-0000" className="h-11" />
            </Field>
            <Field label="텔레그램 아이디" hint="@ 없이 아이디만">
              <Input value={f.contactTelegram} onChange={(e) => setF({ ...f, contactTelegram: e.target.value.replace(/^@/, "") })} placeholder="BGT_OP" className="h-11" />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[14px] font-bold text-ink">주간 · 야간 시간</div>
          <div className="mt-1 text-[11px] leading-[1.7] text-mute">
            룸 배치를 짤 때 주간·야간 칸에 기본으로 들어가는 시간이에요.
            사람마다 다르면 배치표에서 그 사람 시간만 따로 고치면 돼요.
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="주간 시작 (= 오픈)">
              <Input type="time" value={f.openTime} onChange={(e) => setF({ ...f, openTime: e.target.value })} className="h-11" />
            </Field>
            <Field label="교대 시각 (주간 끝 · 야간 시작)">
              <Input type="time" value={f.shiftSplitTime} onChange={(e) => setF({ ...f, shiftSplitTime: e.target.value })} className="h-11" />
            </Field>
            <Field label="야간 끝 (= 마감)">
              <Input type="time" value={f.closeTime} onChange={(e) => setF({ ...f, closeTime: e.target.value })} className="h-11" />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-xl bg-day-bg px-3 py-2 text-[12px] font-bold text-day">주간 {f.openTime} ~ {f.shiftSplitTime}</span>
            <span className="rounded-xl bg-night-bg px-3 py-2 text-[12px] font-bold text-night">야간 {f.shiftSplitTime} ~ {f.closeTime < f.openTime ? "익일 " : ""}{f.closeTime}</span>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" className="w-auto px-8" onClick={submit} loading={pending}>설정 저장</Button>
          <Button variant="outline" onClick={() => start(async () => { const r = await triggerReminders(slug); toast(r.ok ? `1시간 전 리마인드 ${r.data?.count ?? 0}건 발송 (콘솔 로그 확인)` : r.error, r.ok ? "success" : "error"); })}>리마인드 수동 발송 (테스트)</Button>
        </div>
        <Card className="p-4 text-[11px] leading-[1.7] text-mute">
          <b className="text-ink">Phase 2 확장 지점</b> — 결제·선입금, 카카오 알림톡(NotificationService 구현체 교체), 리뷰 포인트/쿠폰, 웨이팅, POS 연동, 다국어. 코드에 인터페이스만 남겨두고 구현하지 않았어요.
        </Card>
      </div>

      {/* 라이브 프리뷰 */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <div className="mb-2 text-[11px] font-semibold text-mute">고객 화면 미리보기</div>
        <div style={themeStyle(f.theme, f.themeColor) as React.CSSProperties} className="overflow-hidden rounded-[28px] border-[5px] border-card bg-paper text-ink shadow-pop">
          <div className="hero-grad relative overflow-hidden px-5 pb-7 pt-7">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.logoUrl && <img src={f.logoUrl} alt="" className="h-7 w-7 rounded-lg border border-card" />}
              <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-gold">{f.name || "매장명"}</span>
            </div>
            <div className="mt-3 font-serif text-[20px] font-bold leading-[1.5] text-ink">오늘 자리를 지키는<br />세 사람</div>
            <div className="mt-2 text-[11px] text-mute">{f.tagline || "태그라인"} · {f.openTime} 오픈</div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blush-lt font-serif font-bold text-brand">준</div>
              <div className="flex-1">
                <div className="flex items-center gap-2"><span className="font-serif text-[15px] font-bold text-ink">준희</span><span className="rounded-full bg-blush-lt px-2 py-0.5 text-[9px] font-bold text-brand">★ 4.9</span></div>
                <div className="mt-1 text-[10px] text-mute">#상냥함 #조용한대화</div>
              </div>
            </div>
            <div className="cta-grad mt-4 flex h-12 items-center justify-center rounded-2xl text-[13px] font-bold text-white shadow-cta">준희 예약하기</div>
          </div>
        </div>
      </div>
    </div>
  );
}
