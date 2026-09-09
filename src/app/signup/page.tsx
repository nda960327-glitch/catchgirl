import Link from "next/link";
import { PricingTable } from "@/components/pricing-table";
import { OPERATOR_CONTACT, TERMS_VERSION } from "@/lib/terms";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "매장 가입 신청" };

/**
 * 업체가 직접 매장을 신청하는 화면 — 로그인 없이 열린다.
 * 신청하면 잠긴 채로 만들어지고, 운영사가 등록증을 확인해 승인해야 열린다.
 */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const { agent } = await searchParams;
  const agentCode = (agent ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Sign up</div>
        <h1 className="mt-1 font-serif text-[24px] font-bold text-ink">매장 가입 신청</h1>
        <p className="mt-2 text-[12px] leading-[1.9] text-mute">
          전담 매니저(바텐더) 예약과 출근·룸 배치·수금·손님 관리를 한 화면에서 하는 매장용 앱이에요.
          신청서를 내면 운영사가 사업자등록증과 업종을 확인한 뒤 승인해요. 승인 전에는 매장 화면이 열리지 않아요.
        </p>

        {/* 요금 — 신청 전에 알아야 할 것 */}
        <div className="mt-5"><PricingTable compact /></div>
        <div className="mt-2 text-[11px] text-mute">초기 구축비는 없어요. 결제는 CMS 자동이체로, 승인 뒤 운영사가 보내는 링크로 출금 동의를 등록하면 매월 5일 매장 계좌에서 빠져요. 첫 달은 무료예요. 신청만으로 요금이 나가지 않아요.</div>

        <div className="mt-6">
          <SignupForm agentCode={agentCode} />
        </div>

        <div className="mt-6 rounded-2xl bg-card p-4 text-[11px] leading-[1.8] text-mute shadow-card">
          <b className="text-ink">궁금한 게 있으면</b> 텔레그램 <a href={`https://t.me/${OPERATOR_CONTACT.telegram}`} target="_blank" rel="noreferrer" className="font-bold text-brand">@{OPERATOR_CONTACT.telegram}</a> 또는 전화 <a href={`tel:${OPERATOR_CONTACT.phone.replace(/[^0-9+]/g, "")}`} className="font-bold text-brand">{OPERATOR_CONTACT.phone}</a>
          <br />
          약관 전문은 <Link href="/platform/terms" target="_blank" className="font-bold text-brand underline-offset-2 hover:underline">여기</Link>에서 볼 수 있어요 ({TERMS_VERSION} 판).
        </div>
      </div>
    </div>
  );
}
