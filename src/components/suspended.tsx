import { OPERATOR_CONTACT, PENDING_REASON } from "@/lib/terms";
/**
 * 이용이 중지된 매장의 화면.
 *
 * 손님이 이걸 보면 매장 잘못이 아니라 앱 잘못처럼 보여야 한다 — 미납은
 * 매장과 파는 쪽 사이의 일이지 손님이 알 일이 아니다. 그래서 사유는 관리자에게만
 * 보이고 손님에게는 "잠시 쉬어요" 정도로만 말한다. 문의 창구는 그대로 열어 둔다.
 */
export function Suspended({ name, reason, phone, telegram }: { name: string; reason: string; phone: string; telegram: string }) {
  const tg = telegram.replace(/^@/, "");
  if (reason === PENDING_REASON) return <Pending name={name} />;
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

/**
 * 직접 신청한 매장이 아직 승인 전일 때. 손님이 볼 일은 거의 없고(주소를 아직 안 돌렸으니),
 * 주로 신청한 사장이 관리자 주소를 눌러 보는 화면이다.
 */
function Pending({ name }: { name: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-frame p-6 text-ink">
      <div className="w-full max-w-sm rounded-[28px] bg-card p-7 text-center shadow-pop">
        <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">{name}</div>
        <h1 className="mt-2 font-serif text-[20px] font-bold text-ink">열 준비를 하고 있어요</h1>
        <p className="mt-2 text-[12px] leading-[1.9] text-mute">
          가입 신청을 받았고, 운영사가 사업자등록증과 업종을 확인하고 있어요.
          <br />
          확인이 끝나면 이 주소가 바로 열려요. 보통 영업일 하루 안이에요.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <a href={`https://t.me/${OPERATOR_CONTACT.telegram}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-line bg-card py-3 text-[13px] font-bold text-ink">
            운영사 텔레그램 @{OPERATOR_CONTACT.telegram}
          </a>
          <a href={`tel:${OPERATOR_CONTACT.phone.replace(/[^0-9+]/g, "")}`} className="rounded-2xl border border-line bg-card py-3 text-[13px] font-bold text-ink">
            운영사 전화 {OPERATOR_CONTACT.phone}
          </a>
        </div>
      </div>
    </div>
  );
}
