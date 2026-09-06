"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * 문의 버튼.
 *
 * 예약을 앱에서만 받는 게 아니라, 물어보고 싶은 걸 바로 묻고 싶어 하는 손님이 많다.
 * 누르면 텔레그램 대화나 전화로 곧장 이어진다 — 앱 안에 문의함을 따로 만들면
 * 매장이 그걸 또 들여다봐야 해서, 매장이 이미 쓰는 창구로 보낸다.
 */
export function ContactFab({ phone, telegram }: { phone: string; telegram: string }) {
  const [open, setOpen] = useState(false);
  if (!phone && !telegram) return null;

  const tg = telegram.replace(/^@/, "");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="문의하기"
        className="fixed bottom-[86px] right-4 z-30 flex h-12 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-bold text-white shadow-pop"
      >
        <span aria-hidden>✆</span> 문의
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-[28px] bg-paper p-6 pb-8 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-serif text-[18px] font-bold text-ink">무엇이든 물어보세요</div>
                <div className="mt-0.5 text-[11px] text-mute">예약·자리·시간 안내를 바로 도와드려요.</div>
              </div>
              <button onClick={() => setOpen(false)} className="h-8 w-8 shrink-0 rounded-full border border-line bg-card text-mute">✕</button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {tg && (
                <a
                  href={`https://t.me/${tg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-night-bg text-[17px]" aria-hidden>✈</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-ink">텔레그램으로 문의</span>
                    <span className="block text-[11px] text-mute">@{tg}</span>
                  </span>
                  <span className="text-[13px] text-mute" aria-hidden>›</span>
                </a>
              )}
              {phone && (
                <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blush-lt text-[17px]" aria-hidden>✆</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-ink">전화로 문의</span>
                    <span className="block text-[11px] text-mute">{phone}</span>
                  </span>
                  <span className="text-[13px] text-mute" aria-hidden>›</span>
                </a>
              )}
            </div>

            <p className={cn("mt-3 text-center text-[10px] leading-[1.7] text-mute")}>
              영업시간에는 바로 답을 드려요. 앱에서 예약하시면 자리까지 미리 잡아 드립니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
