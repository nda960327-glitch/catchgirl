import Link from "next/link";
import { PRIVACY, PRIVACY_TITLE, PRIVACY_VERSION } from "@/lib/privacy";

/**
 * 개인정보처리방침 — 로그인 없이 열린다.
 * 손님 로그인 화면, 가입 페이지, 홈 푸터에서 이리로 온다.
 */
export const dynamic = "force-static";

export const metadata = {
  title: PRIVACY_TITLE,
  description: "캐치걸이 무엇을 받고 무엇을 안 받는지, 얼마나 보관하고 어디에 맡기는지 적은 개인정보처리방침이에요. 손님의 실명과 전화번호는 처음부터 받지 않아요.",
  alternates: { canonical: "https://www.catchgirl.kr/platform/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Privacy Policy</div>
        <h1 className="mt-1 font-serif text-[24px] font-bold text-ink">{PRIVACY_TITLE}</h1>
        <div className="mt-1 text-[12px] text-mute">{PRIVACY_VERSION} 시행</div>

        <div className="mt-6 rounded-2xl border border-line bg-card px-4 py-3 text-[12px] leading-[1.8] text-ink">
          <b>짧게 말하면.</b> 손님의 실명·전화번호·이메일은 처음부터 받지 않아요. 닉네임과 PIN 만 있고, PIN 은 암호화돼 운영사도 못 봐요.
          누구에게도 팔거나 주지 않고, 광고 쿠키를 쓰지 않아요. 매장이 해지하면 90일 뒤 지워요.
        </div>

        <div className="mt-6 flex flex-col gap-5 rounded-[24px] bg-card p-6 shadow-card">
          {PRIVACY.map((t) => (
            <section key={t.title}>
              <h2 className="text-[13px] font-bold text-ink">{t.title}</h2>
              <p className="mt-1.5 whitespace-pre-line text-[12px] leading-[1.9] text-mute">{t.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-6 text-[11px] leading-[1.8] text-mute">
          서비스 이용 조건은 <Link href="/platform/terms" className="font-bold text-brand underline-offset-2 hover:underline">서비스 이용 약관</Link>에 있어요.
          <br />
          <Link href="/" className="underline-offset-2 hover:underline">← 캐치걸 홈</Link>
        </div>
      </div>
    </div>
  );
}
