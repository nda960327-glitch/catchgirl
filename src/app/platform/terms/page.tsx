import { TERMS, TERMS_TITLE, TERMS_VERSION } from "@/lib/terms";

/**
 * 약관 전문 — 로그인 없이 열린다.
 * 계약 전에 대표자에게 보내 읽게 하는 페이지라 콘솔 비밀번호 뒤에 두지 않는다.
 */
export const dynamic = "force-static";

export const metadata = { title: `${TERMS_TITLE} · ${TERMS_VERSION}` };

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Terms of Service</div>
        <h1 className="mt-1 font-serif text-[24px] font-bold text-ink">{TERMS_TITLE}</h1>
        <div className="mt-1 text-[12px] text-mute">{TERMS_VERSION} 판 · 계약 전에 대표자가 읽고 동의해야 해요</div>

        <div className="mt-6 rounded-2xl border border-bad/30 bg-bad-bg px-4 py-3 text-[12px] leading-[1.8] text-ink">
          <b>먼저 읽어 주세요.</b> 이 서비스는 전담 매니저(바텐더) 예약과 매장 운영을 돕는 소프트웨어예요. 성매매 알선 등 3항의 금지 행위가 확인되면 사전 통지 없이 즉시 이용이 정지되고, 정지 기간의 요금과 초기 구축비는 돌려드리지 않아요.
        </div>

        <div className="mt-6 flex flex-col gap-5 rounded-[24px] bg-card p-6 shadow-card">
          {TERMS.map((t) => (
            <section key={t.title}>
              <h2 className="text-[13px] font-bold text-ink">{t.title}</h2>
              <p className="mt-1.5 whitespace-pre-line text-[12px] leading-[1.9] text-mute">{t.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-6 text-[11px] leading-[1.8] text-mute">
          동의는 매장을 여는 콘솔에서 운영사가 대표자 이름과 함께 기록해요. 어느 판에 언제 동의했는지는 매장 관리자 화면의 '요금제' 에서 볼 수 있어요.
        </div>
      </div>
    </div>
  );
}
