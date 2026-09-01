"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Chrome 계열이 설치 가능해질 때 던지는 이벤트 (표준 타입에 아직 없다) */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const COPY = {
  customer: { title: "앱으로 설치하고 더 빠르게 예약하세요", desc: "홈 화면에 추가하면 브라우저 주소를 찾지 않아도 바로 열려요." },
  staff: { title: "내 일정, 앱으로 바로 확인하세요", desc: "홈 화면에 추가하면 출근·예약·매출을 한 번에 열 수 있어요." },
  admin: { title: "관리자 화면을 앱처럼 쓰세요", desc: "홈 화면에 추가하면 매장에서 바로 열어 확인할 수 있어요." },
} as const;

/**
 * 홈 화면 추가 안내.
 * 안드로이드·데스크톱 크롬은 설치 버튼을 바로 띄우고,
 * iOS 사파리는 설치 API 가 없어 '공유 → 홈 화면에 추가' 순서를 글로 안내한다.
 */
export function InstallApp({ role, className }: { role: keyof typeof COPY; className?: string }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(true); // 판단 전엔 감춘다

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent));

    let hidden = false;
    try {
      hidden = localStorage.getItem(`install-dismissed-${role}`) === "1";
    } catch {
      hidden = false; // 시크릿 모드 등에서 접근이 막혀도 안내는 띄운다
    }
    setDismissed(hidden || standalone);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDismissed(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [role]);

  const hide = () => {
    setDismissed(true);
    try { localStorage.setItem(`install-dismissed-${role}`, "1"); } catch { /* 저장 못 해도 이번 세션은 닫힌다 */ }
  };

  if (installed || dismissed) return null;
  const copy = COPY[role];

  return (
    <div className={cn("rounded-[20px] border border-brand/30 bg-blush-lt/50 px-4 py-3.5", className)}>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/icon.webp" alt="" className="h-10 w-10 shrink-0 rounded-xl border border-white shadow-card" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-ink">{copy.title}</div>
          <div className="mt-0.5 text-[11px] leading-[1.7] text-mute">{copy.desc}</div>

          {isIOS ? (
            <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-[1.8] text-mute">
              아이폰은 사파리 아래쪽 <b className="text-ink">공유 버튼</b>을 누르고<br />
              <b className="text-ink">홈 화면에 추가</b>를 선택하시면 돼요.
            </div>
          ) : deferred ? (
            <button
              onClick={async () => {
                await deferred.prompt();
                const { outcome } = await deferred.userChoice;
                if (outcome === "accepted") setInstalled(true);
                setDeferred(null);
              }}
              className="mt-2 rounded-xl bg-brand px-3.5 py-2 text-[12px] font-bold text-white shadow-cta"
            >
              앱으로 설치하기
            </button>
          ) : (
            <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-[1.8] text-mute">
              브라우저 메뉴에서 <b className="text-ink">홈 화면에 추가</b> 또는 <b className="text-ink">앱 설치</b>를 선택해 주세요.
            </div>
          )}
        </div>
        <button onClick={hide} aria-label="닫기" className="shrink-0 text-[16px] leading-none text-mute/70 hover:text-mute">✕</button>
      </div>
    </div>
  );
}
