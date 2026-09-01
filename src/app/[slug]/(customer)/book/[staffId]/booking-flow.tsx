"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Avatar, Button, Chip, Field, Input, Skeleton, Sticker, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, toLocalDate, WEEKDAYS_KO } from "@/lib/utils";
import { bookReservation } from "../../actions";

type Slot = { time: string; status: "open" | "full" | "off" | "past"; remaining: number; maxHours: number };
type Day = { date: string; weekday: number; disabled: boolean; reason?: string };
type Opt = { id: string; name: string; price: number };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
/** 시작 시각 + 이용 시간 → 종료 시각 (자정 넘김 표기 포함) */
function endLabel(time: string, hours: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + hours * 60;
  const hh = Math.floor(total / 60);
  return `${String(hh % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}${hh >= 24 ? " (익일)" : ""}`;
}

export function BookingFlow({
  slug, staff, store, options, days, initialDate, initialTime, initialSlots, customer, autoDiscount, coupons,
}: {
  slug: string;
  staff: { id: string; nickname: string; photo: string | null; hourlyPrice: number };
  store: { name: string; cancelDeadlineHours: number; slotMinutes: number };
  options: Opt[];
  days: Day[];
  initialDate: string;
  initialTime: string | null;
  initialSlots: Slot[];
  customer: { nickname: string } | null;
  /** 자동으로 붙는 할인 (등급·기간 중 큰 것 하나) */
  autoDiscount: { label: string; amount: number } | null;
  coupons: { id: string; name: string; amount: number; expiresAt: string | null }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(initialTime ? 3 : 1);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState<string | null>(initialTime);
  const [hours, setHours] = useState(1);
  const [couponId, setCouponId] = useState<string | null>(null);
  const [optIds, setOptIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  // 실시간 슬롯: 5초 폴링 (Supabase Realtime 구독으로 교체 가능한 지점)
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["slots", staff.id, date],
    queryFn: async () => {
      const r = await fetch(`/api/slots?staffId=${staff.id}&date=${date}`, { cache: "no-store" });
      if (!r.ok) throw new Error("slots");
      return (await r.json()) as { slots: Slot[] };
    },
    initialData: date === initialDate ? { slots: initialSlots } : undefined,
    refetchInterval: step === 2 ? 5000 : false,
    refetchOnWindowFocus: true,
  });
  const slots = data?.slots;

  // 내가 고른 시간이 다른 사람에게 선점되면 선택 해제 + 안내
  useEffect(() => {
    if (!slots || !time) return;
    const s = slots.find((x) => x.time === time);
    if (s && s.status !== "open" && step === 2) {
      setTime(null);
      toast("방금 다른 분이 예약했어요. 다른 시간을 골라주세요.", "error");
    }
  }, [slots, time, step, toast]);

  const dateObj = useMemo(() => toLocalDate(date, "00:00"), [date]);
  const openCount = slots?.filter((s) => s.status === "open").length ?? 0;
  const maxHours = slots?.find((s) => s.time === time)?.maxHours ?? 1;

  // 고른 시간이 짧아지면(뒤 자리가 차면) 이용 시간을 가능한 범위로 되돌린다
  useEffect(() => {
    if (time && hours > maxHours && maxHours >= 1) setHours(maxHours);
  }, [time, hours, maxHours]);

  const chosenOpts = options.filter((o) => optIds.includes(o.id));
  const optionsPrice = chosenOpts.reduce((a, o) => a + o.price, 0);
  const listPrice = staff.hourlyPrice * hours + optionsPrice;
  // 자동 할인 + 고른 쿠폰. 정가보다 많이 깎이지는 않는다 (서버에서도 같은 계산을 한다)
  const coupon = coupons.find((c) => c.id === couponId) ?? null;
  const discount = Math.min(listPrice, (autoDiscount?.amount ?? 0) + (coupon?.amount ?? 0));
  const total = listPrice - discount;

  const submit = () => {
    if (!time) return;
    if (!customer) {
      router.push(`/${slug}/login?next=${encodeURIComponent(`/${slug}/book/${staff.id}?date=${date}&time=${time}`)}`);
      return;
    }
    start(async () => {
      const r = await bookReservation(slug, { staffId: staff.id, date, time, hours, optionIds: optIds, couponId: couponId ?? undefined, partySize: 1, requestNote: note });
      if (r.ok && r.data) {
        router.push(`/${slug}/done/${r.data.id}`);
        return;
      }
      if (!r.ok) {
        if (r.error === "LOGIN_REQUIRED") return router.push(`/${slug}/login?next=${encodeURIComponent(`/${slug}/book/${staff.id}?date=${date}&time=${time}`)}`);
        toast(r.error, "error");
        if (r.conflict) {
          setTime(null);
          setStep(2);
          refetch();
        }
      }
    });
  };

  const title = step === 1 ? "날짜 선택" : step === 2 ? "시간 선택" : "예약 정보";
  const back = () => (step === 1 ? router.push(`/${slug}/bartenders/${staff.id}`) : setStep((s) => (s - 1) as 1 | 2 | 3));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* 상단바 */}
      <div className="sticky top-0 z-20 flex h-14 items-center border-b border-line bg-white/90 px-4 backdrop-blur">
        <button onClick={back} className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-ink" aria-label="뒤로">‹</button>
        <div className="flex-1 text-center font-serif text-[15px] font-bold text-ink">{title}</div>
        <div className="w-8 text-right text-[12px] font-semibold text-blush">{step}/3</div>
      </div>

      {/* 캐치걸 요약 */}
      <div className="flex items-center gap-3 px-[18px] pt-4">
        <Avatar src={staff.photo} name={staff.nickname} size={40} rounded={13} />
        <div>
          <div className="text-[13px] font-bold text-ink">{staff.nickname}</div>
          <div className="text-[11px] text-mute">
            {format(dateObj, "M월 d일 (EEE)", { locale: ko })}
            {time ? ` · ${time}` : ""}
          </div>
        </div>
        <div className="ml-auto flex gap-1">
          {[1, 2, 3].map((i) => (
            <span key={i} className={cn("h-1.5 w-5 rounded-full", i <= step ? "bg-brand" : "bg-[#E8DCDE]")} />
          ))}
        </div>
      </div>

      <div className="flex-1 px-[18px] pb-6 pt-4">
        {step === 1 && (
          <div className="animate-fade">
            <div className="mb-3 text-[12px] text-mute">예약 가능한 날짜를 골라주세요. 회색은 휴무·근무 없는 날이에요.</div>
            <div className="grid grid-cols-5 gap-2">
              {days.map((d) => {
                const on = d.date === date;
                const dt = toLocalDate(d.date, "00:00");
                return (
                  <button
                    key={d.date}
                    disabled={d.disabled}
                    onClick={() => { setDate(d.date); setTime(null); }}
                    title={d.reason}
                    className={cn(
                      "flex min-h-[64px] flex-col items-center justify-center rounded-2xl border py-2 transition-all",
                      d.disabled && "cursor-not-allowed border-[#F4EDEE] bg-[#F4EDEE] text-[#CDBEC1]",
                      !d.disabled && !on && "border-line bg-white text-ink",
                      on && "ring-brand border-brand bg-brand text-white",
                    )}
                  >
                    <span className={cn("text-[10px] font-medium", on ? "opacity-80" : d.weekday === 0 ? "text-brand" : "")}>{WEEKDAYS_KO[d.weekday]}</span>
                    <span className="mt-0.5 font-serif text-[17px] font-bold">{dt.getDate()}</span>
                    {d.disabled && <span className="mt-0.5 text-[8px]">{d.reason}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade">
            <div className="mb-3.5 flex items-center gap-3.5 px-0.5">
              {[
                ["가능", "bg-white border-line"],
                ["마감", "bg-[#F4EDEE] border-[#F4EDEE]"],
                ["근무 외", "bg-[#FAF6F7] border-dashed border-[#E3D3D6]"],
                ["선택", "bg-brand border-brand"],
              ].map(([l, c]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className={cn("h-[11px] w-[11px] rounded border", c)} />
                  <span className="text-[11px] text-mute">{l}</span>
                </div>
              ))}
              <span className={cn("ml-auto text-[10px]", isFetching ? "text-brand" : "text-mute/70")}>{isFetching ? "갱신 중…" : "5초마다 갱신"}</span>
            </div>
            {!slots ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 16 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((s) => {
                  const on = time === s.time;
                  const disabled = s.status !== "open";
                  return (
                    <button
                      key={s.time}
                      disabled={disabled}
                      onClick={() => { setTime(s.time); setHours((h) => Math.min(Math.max(1, h), s.maxHours)); }}
                      className={cn(
                        "h-12 rounded-[14px] border text-[13px] font-semibold transition-all",
                        on && "ring-brand border-brand bg-brand text-white",
                        !on && s.status === "open" && "border-line bg-white text-ink active:scale-95",
                        s.status === "full" && "cursor-not-allowed border-[#F4EDEE] bg-[#F4EDEE] text-[#CDBEC1] line-through",
                        s.status === "past" && "cursor-not-allowed border-[#F4EDEE] bg-[#F4EDEE] text-[#CDBEC1]",
                        s.status === "off" && "cursor-not-allowed border-dashed border-[#E3D3D6] bg-[#FAF6F7] text-[#CDBEC1]",
                      )}
                    >
                      {s.time}
                    </button>
                  );
                })}
              </div>
            )}
            {slots && openCount === 0 && (
              <div className="mt-6 flex flex-col items-center text-center">
                <Sticker k="p6" size={80} />
                <div className="mt-1 text-[13px] font-semibold text-ink">이 날은 자리가 모두 찼어요</div>
                <button onClick={() => setStep(1)} className="mt-1 text-[11px] font-semibold text-brand">다른 날짜 보기 ›</button>
              </div>
            )}

            {/* 이용 시간 — 뒤가 비어 있는 만큼만 이어서 예약할 수 있다 */}
            {time && (
              <div className="animate-fade mt-6">
                <div className="flex items-baseline justify-between px-0.5">
                  <span className="text-[13px] font-bold text-ink">몇 시간 이용하실까요</span>
                  <span className="text-[11px] text-mute">{time} ~ {endLabel(time, hours)}</span>
                </div>
                <div className="mt-2.5 grid grid-cols-4 gap-2">
                  {Array.from({ length: maxHours }, (_, i) => i + 1).map((h) => (
                    <button
                      key={h}
                      onClick={() => setHours(h)}
                      className={cn(
                        "h-12 rounded-[14px] border text-[13px] font-semibold transition-all",
                        hours === h ? "border-brand bg-brand text-white" : "border-line bg-white text-ink active:scale-95",
                      )}
                    >
                      {h}시간
                    </button>
                  ))}
                </div>
                <div className="mt-2 px-0.5 text-[11px] text-mute">
                  {staff.nickname} 시간당 {won(staff.hourlyPrice)} · {hours}시간 <b className="text-brand">{won(staff.hourlyPrice * hours)}</b>
                  {maxHours < 8 && <span className="ml-1">· 이 시간부터는 최대 {maxHours}시간</span>}
                </div>
              </div>
            )}
            <div className="mt-[22px] flex items-center gap-3 rounded-[18px] bg-blush-lt p-4">
              <Sticker k="p3" size={54} />
              <div className="text-[11px] leading-[1.75] text-brand">
                방문 {store.cancelDeadlineHours}시간 전까지 취소할 수 있어요.
                <br />예약은 결제 없이 바로 확정됩니다.
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade flex flex-col gap-4">
            <div className="rounded-[18px] border border-line bg-white p-4">
              <div className="text-[11px] text-mute">예약 정보</div>
              <div className="mt-1 font-serif text-[16px] font-bold text-ink">
                {format(dateObj, "M월 d일 (EEE)", { locale: ko })} {time} ~ {time && endLabel(time, hours)}
              </div>
              <div className="mt-0.5 text-[12px] text-mute">{staff.nickname} · {hours}시간</div>
              <button onClick={() => setStep(2)} className="mt-1 text-[11px] font-semibold text-brand">시간 변경 ›</button>
            </div>

            {options.length > 0 && (
              // Field 는 <label> 이라 그 안에 버튼을 두면 클릭이 첫 버튼으로 넘어간다 — 여기선 쓰지 않는다
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[12px] font-semibold text-ink">추가 옵션</span>
                  <span className="text-[11px] text-mute">선택 · 예약당 1회</span>
                </div>
                <div className="flex flex-col gap-2">
                  {options.map((o) => {
                    const on = optIds.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setOptIds((v) => (on ? v.filter((x) => x !== o.id) : [...v, o.id]))}
                        className={cn(
                          "flex h-12 items-center gap-3 rounded-2xl border px-4 text-[13px] transition-all active:scale-[.99]",
                          on ? "border-brand bg-blush-lt" : "border-line bg-white",
                        )}
                      >
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border text-[11px]", on ? "border-brand bg-brand text-white" : "border-line bg-white text-transparent")}>✓</span>
                        <span className={cn("font-semibold", on ? "text-brand" : "text-ink")}>{o.name}</span>
                        <span className="ml-auto text-mute">+{won(o.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 쿠폰 — 자동 할인 위에 한 장 더 쓸 수 있다 */}
            {coupons.length > 0 && (
              <div className="rounded-[18px] border border-line bg-white p-4">
                <div className="text-[12px] font-bold text-ink">쿠폰</div>
                <div className="mt-0.5 text-[10px] text-mute">한 번 쓰면 사라져요. 예약 1건에 한 장만 쓰실 수 있어요.</div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {coupons.map((c) => {
                    const on = couponId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setCouponId(on ? null : c.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] transition-colors",
                          on ? "border-brand bg-blush-lt/60" : "border-line bg-white hover:border-brand/50",
                        )}
                      >
                        <span className={cn("h-4 w-4 shrink-0 rounded-full border", on ? "border-[5px] border-brand" : "border-line")} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold text-ink">{c.name}</span>
                          {c.expiresAt && <span className="block text-[10px] text-mute">{c.expiresAt}까지</span>}
                        </span>
                        <span className="font-bold text-brand">−{won(c.amount)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 금액 */}
            <div className="rounded-[18px] border border-line bg-white p-4">
              <div className="flex justify-between text-[12px] text-mute">
                <span>{staff.nickname} {won(staff.hourlyPrice)} × {hours}시간</span>
                <span className="text-ink">{won(staff.hourlyPrice * hours)}</span>
              </div>
              {chosenOpts.map((o) => (
                <div key={o.id} className="mt-1.5 flex justify-between text-[12px] text-mute">
                  <span>{o.name}</span>
                  <span className="text-ink">+{won(o.price)}</span>
                </div>
              ))}
              {autoDiscount && (
                <div className="mt-1.5 flex justify-between text-[12px]">
                  <span className="text-brand">{autoDiscount.label}</span>
                  <span className="font-semibold text-brand">−{won(autoDiscount.amount)}</span>
                </div>
              )}
              {coupon && (
                <div className="mt-1.5 flex justify-between text-[12px]">
                  <span className="text-brand">{coupon.name}</span>
                  <span className="font-semibold text-brand">−{won(coupon.amount)}</span>
                </div>
              )}
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-[12px] font-semibold text-ink">결제 예정 금액</span>
                <span className="flex items-baseline gap-1.5">
                  {discount > 0 && <span className="text-[12px] text-mute line-through">{won(listPrice)}</span>}
                  <span className="font-serif text-[20px] font-bold text-brand">{won(total)}</span>
                </span>
              </div>
              <div className="mt-1.5 text-[10px] text-mute">현장에서 결제해요. 예약은 결제 없이 바로 확정됩니다.</div>
            </div>
            <Field label="닉네임">
              {customer ? (
                <Input value={customer.nickname} readOnly className="bg-[#FAF6F7]" />
              ) : (
                <div className="flex h-12 items-center justify-between rounded-2xl border border-dashed border-blush bg-white px-4 text-[13px]">
                  <span className="text-mute">다음 단계에서 닉네임·PIN을 입력해요</span>
                </div>
              )}
            </Field>
            <Field label="요청사항" hint="선택 · 200자">
              <Textarea rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="창가 자리, 조용한 자리, 축하 세팅 등" />
            </Field>
            <div className="rounded-2xl bg-[#FAF6F7] px-4 py-3 text-[11px] leading-[1.7] text-mute">
              <Chip tone="mute" className="mr-1.5">노쇼 정책</Chip>
              예약 시간 15분 경과 시 노쇼 처리돼요. 못 오시게 되면 {store.cancelDeadlineHours}시간 전까지 취소를 부탁드려요.
            </div>
          </div>
        )}
      </div>

      {/* 하단 CTA */}
      <div className="sticky bottom-0 border-t border-line bg-white/95 p-4 backdrop-blur">
        {step === 1 && <Button size="lg" onClick={() => setStep(2)}>{format(dateObj, "M월 d일", { locale: ko })} 시간 보기</Button>}
        {step === 2 && (
          <Button size="lg" disabled={!time} onClick={() => setStep(3)}>
            {time ? `${time}부터 ${hours}시간 · ${won(staff.hourlyPrice * hours)}` : "시간을 선택해 주세요"}
          </Button>
        )}
        {step === 3 && (
          <Button size="lg" onClick={submit} loading={pending}>
            {customer ? `${won(total)} 예약 확정하기` : "닉네임으로 계속하기"}
          </Button>
        )}
        <div className="mt-2 text-center text-[10px] text-mute/80">
          <Link href={`/${slug}/bartenders/${staff.id}`} className="underline-offset-2 hover:underline">프로필로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
}
