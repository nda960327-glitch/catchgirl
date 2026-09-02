"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn, won } from "@/lib/utils";

type Item = { id: string; code: string; customer: string; staff: string; at: string; room: string | null; hours: number; price: number };

const POLL_MS = 20_000;

const timeKo = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * 새 예약 알림.
 *
 * 관리자 화면은 서버에서 그려지고 나면 스스로 바뀌지 않는다. 영업 중에 손님이
 * 넣은 예약을 놓치면 자리를 못 잡아 주므로 20초마다 확인해서 배지로 알린다.
 *
 * 브라우저 알림 권한을 주면 다른 탭을 보고 있어도 뜬다. 권한을 주지 않아도
 * 배지와 목록은 그대로 동작한다 — 알림은 거들 뿐이다.
 */
export function NewReservationAlert({ slug }: { slug: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [canNotify, setCanNotify] = useState<"unsupported" | "default" | "granted" | "denied">("default");
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);
  const router = useRouter();

  useEffect(() => {
    if (typeof Notification === "undefined") setCanNotify("unsupported");
    else setCanNotify(Notification.permission as "default" | "granted" | "denied");
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/${slug}/admin/api/new-reservations`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Item[] };
      setItems(data.items);

      // 처음 한 번은 알리지 않는다 — 화면을 켜자마자 밀린 알림이 쏟아지면 성가시다
      const fresh = data.items.filter((i) => !seen.current.has(i.id));
      data.items.forEach((i) => seen.current.add(i.id));
      if (first.current) { first.current = false; return; }
      if (fresh.length === 0) return;

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const i of fresh.slice(0, 3)) {
          new Notification("새 예약이 들어왔어요", {
            body: `${i.customer}님 · ${i.staff} · ${timeKo(i.at)}${i.room ? ` · ${i.room}` : ""}`,
            tag: i.id,
            icon: "/assets/icon-admin-192.png",
          });
        }
      }
    } catch {
      /* 잠깐 끊겨도 다음 차례에 다시 물어본다 */
    }
  }, [slug]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [poll]);

  const markSeen = async () => {
    await fetch(`/${slug}/admin/api/new-reservations`, { method: "POST" });
    setItems([]);
    setOpen(false);
    router.refresh();
  };

  const ask = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setCanNotify(p as "default" | "granted" | "denied");
  };

  const n = items.length;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={n > 0 ? `새 예약 ${n}건` : "새 예약 없음"}
        className={cn(
          "relative flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition-colors",
          n > 0 ? "border-brand bg-brand text-white shadow-cta" : "border-line bg-white text-mute hover:border-brand",
        )}
      >
        <span aria-hidden>♪</span>
        {n > 0 ? `새 예약 ${n}` : "알림"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-20 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-[24px] bg-paper p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-serif text-[16px] font-bold text-ink">새 예약 {n}건</span>
              <button onClick={() => setOpen(false)} className="h-7 w-7 rounded-full border border-line bg-white text-mute">✕</button>
            </div>

            {canNotify === "default" && (
              <button onClick={ask} className="mt-3 w-full rounded-2xl border border-brand/40 bg-blush-lt/50 px-4 py-2.5 text-left text-[11px] leading-[1.7] text-ink">
                <b>브라우저 알림 켜기</b>
                <br />
                <span className="text-mute">다른 화면을 보고 있어도 예약이 들어오면 바로 알려드려요.</span>
              </button>
            )}
            {canNotify === "denied" && (
              <div className="mt-3 rounded-2xl bg-[#FAF6F7] px-4 py-2.5 text-[11px] leading-[1.7] text-mute">
                브라우저에서 알림이 막혀 있어요. 주소창 옆 자물쇠에서 알림을 허용하시면 화면 밖에서도 알려드려요.
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2">
              {n === 0 && <div className="rounded-2xl border border-dashed border-line py-8 text-center text-[12px] text-mute">확인하지 않은 예약이 없어요</div>}
              {items.map((i) => (
                <div key={i.id} className="rounded-2xl border border-line bg-white px-4 py-3 text-[12px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-ink">{i.customer}</span>
                    <span className="text-mute">· {i.staff}</span>
                    {i.room && <span className="ml-auto rounded-md bg-blush-lt px-1.5 py-0.5 text-[10px] font-bold text-brand">{i.room}</span>}
                  </div>
                  <div className="mt-1 text-[11px] text-mute">
                    {timeKo(i.at)} · {i.hours}시간 · {won(i.price)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={markSeen} disabled={n === 0} className="flex-1 rounded-2xl bg-brand py-3 text-[13px] font-bold text-white disabled:opacity-40">
                확인했어요
              </button>
              <button
                onClick={() => { setOpen(false); router.push(`/${slug}/admin/reservations`); }}
                className="rounded-2xl border border-line bg-white px-4 py-3 text-[13px] font-bold text-ink"
              >
                예약 관리
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
