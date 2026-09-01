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

type Slot = { time: string; status: "open" | "full" | "off" | "past"; remaining: number };
type Day = { date: string; weekday: number; disabled: boolean; reason?: string };

export function BookingFlow({
  slug, staff, store, days, initialDate, initialTime, initialSlots, customer,
}: {
  slug: string;
  staff: { id: string; nickname: string; photo: string | null };
  store: { name: string; cancelDeadlineHours: number; slotMinutes: number };
  days: Day[];
  initialDate: string;
  initialTime: string | null;
  initialSlots: Slot[];
  customer: { nickname: string } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(initialTime ? 3 : 1);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState<string | null>(initialTime);
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

  const submit = () => {
    if (!time) return;
    if (!customer) {
      router.push(`/${slug}/login?next=${encodeURIComponent(`/${slug}/book/${staff.id}?date=${date}&time=${time}`)}`);
      return;
    }
    start(async () => {
      const r = await bookReservation(slug, { staffId: staff.id, date, time, partySize: 1, requestNote: note });
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
                      onClick={() => setTime(s.time)}
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
                {format(dateObj, "M월 d일 (EEE)", { locale: ko })} {time} · {staff.nickname}
              </div>
              <button onClick={() => setStep(2)} className="mt-1 text-[11px] font-semibold text-brand">시간 변경 ›</button>
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
            {time ? `${format(dateObj, "M월 d일", { locale: ko })} ${time} 예약하기` : "시간을 선택해 주세요"}
          </Button>
        )}
        {step === 3 && (
          <Button size="lg" onClick={submit} loading={pending}>
            {customer ? "예약 확정하기" : "닉네임으로 계속하기"}
          </Button>
        )}
        <div className="mt-2 text-center text-[10px] text-mute/80">
          <Link href={`/${slug}/bartenders/${staff.id}`} className="underline-offset-2 hover:underline">프로필로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
}
