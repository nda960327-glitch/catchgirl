import { THEMES, type ThemeKey } from "@/lib/themes";

/**
 * 테마 5종을 작은 폰 화면으로 보여준다. 실제 앱이 쓰는 팔레트 값을 그대로 칠하므로
 * 여기서 보이는 색이 곧 손님 화면 색이다.
 */
export function ThemeGallery() {
  const keys = Object.keys(THEMES) as ThemeKey[];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {keys.map((k) => {
        const t = THEMES[k];
        return (
          <div key={k} className="flex flex-col items-center">
            <div className="w-full overflow-hidden rounded-[22px] border-[5px] shadow-pop" style={{ borderColor: "#2a2226", background: t.paper }}>
              {/* 상단 — 로고 자리와 매장명 */}
              <div className="flex items-center gap-1.5 px-3 pt-3">
                <span className="h-5 w-5 rounded-md" style={{ background: t.brand }} />
                <span className="text-[9px] font-bold" style={{ color: t.gold }}>우리 매장</span>
                <span className="ml-auto rounded-full px-1.5 py-0.5 text-[7px] font-bold" style={{ background: t.okBg, color: t.ok }}>오늘 영업</span>
              </div>
              <div className="px-3 pt-2 font-serif text-[12px] font-bold leading-tight" style={{ color: t.ink }}>오늘 자리를<br />지키는 6 사람</div>
              {/* CTA */}
              <div className="mx-3 mt-2 rounded-xl px-2.5 py-2 text-[8px] font-bold" style={{ background: t.brand, color: "#fff" }}>보고 예약하기 ›</div>
              {/* 카드 두 장 */}
              {[0, 1].map((i) => (
                <div key={i} className="mx-3 mt-2 flex items-center gap-2 rounded-xl border p-2" style={{ background: t.card, borderColor: t.line }}>
                  <span className="h-6 w-6 rounded-lg" style={{ background: t.well2 }} />
                  <div className="flex-1">
                    <div className="h-1.5 w-10 rounded" style={{ background: t.ink, opacity: 0.85 }} />
                    <div className="mt-1 h-1 w-14 rounded" style={{ background: t.mute, opacity: 0.6 }} />
                  </div>
                  <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold" style={{ background: t.okBg, color: t.ok }}>지금 가능</span>
                </div>
              ))}
              {/* 탭바 */}
              <div className="mt-3 flex justify-around border-t px-3 py-2 text-[7px] font-bold" style={{ borderColor: t.line, color: t.mute, background: t.card }}>
                <span style={{ color: t.brand }}>홈</span><span>예약</span><span>마이</span>
              </div>
            </div>
            <div className="mt-2 text-[12px] font-bold text-ink">{t.name}</div>
            <div className="text-[10px] text-mute">{t.desc}</div>
          </div>
        );
      })}
    </div>
  );
}
