/**
 * 이용이 중지된 매장의 화면.
 *
 * 손님이 이걸 보면 매장 잘못이 아니라 앱 잘못처럼 보여야 한다 — 미납은
 * 매장과 파는 쪽 사이의 일이지 손님이 알 일이 아니다. 그래서 사유는 관리자에게만
 * 보이고 손님에게는 "잠시 쉬어요" 정도로만 말한다. 문의 창구는 그대로 열어 둔다.
 */
export function Suspended({ name, reason, phone, telegram }: { name: string; reason: string; phone: string; telegram: string }) {
  const tg = telegram.replace(/^@/, "");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-frame p-6 text-ink">
      <div className="w-full max-w-sm rounded-[28px] bg-card p-7 text-center shadow-pop">
        <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">{name}</div>
        <h1 className="mt-2 font-serif text-[20px] font-bold text-ink">잠시 쉬어가는 중이에요</h1>
        <p className="mt-2 text-[12px] leading-[1.9] text-mute">
          지금은 앱으로 예약을 받지 않아요.
          <br />
          예약이나 문의는 매장으로 직접 연락해 주세요.
        </p>
        {(tg || phone) && (
          <div className="mt-5 flex flex-col gap-2">
            {tg && (
              <a href={`https://t.me/${tg}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-line bg-card py-3 text-[13px] font-bold text-ink">
                텔레그램 @{tg}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="rounded-2xl border border-line bg-card py-3 text-[13px] font-bold text-ink">
                전화 {phone}
              </a>
            )}
          </div>
        )}
        {reason && (
          <div className="mt-5 rounded-2xl bg-well px-4 py-3 text-left text-[11px] leading-[1.8] text-mute">
            <b className="text-ink">매장 관리자님께</b> — 이용이 중지된 사유: {reason}
            <br />
            정리되면 바로 다시 열려요. 운영사에 연락해 주세요.
          </div>
        )}
      </div>
    </div>
  );
}
