import Link from "next/link";
import { OPERATOR_CONTACT } from "@/lib/terms";
import { PIN_LOCK_MINUTES, PIN_MAX_FAILS } from "@/lib/account";
import { DeletionForm } from "./deletion-form";

/**
 * 계정 삭제 안내 — 로그인 없이 열린다.
 * 스토어 데이터 보안 양식의 '계정 삭제 요청 URL' 로 적는 페이지라, 앱이 없어도 여기서 끝까지 지울 수 있어야 한다.
 */
export const dynamic = "force-static";

export const metadata = {
  title: "계정 삭제",
  description: "캐치걸 손님 계정을 앱에서, 또는 앱 없이 이 페이지에서 직접 삭제하는 방법이에요.",
  alternates: { canonical: "https://www.catchgirl.kr/platform/account-deletion" },
};

const DELETED = [
  "닉네임과 PIN",
  "내가 쓴 후기와 댓글, 거기 달린 답글",
  "찜과 추천·비추천",
  "아직 안 쓴 쿠폰",
  "매장이 나에 대해 적어 둔 메모와 연락처",
  "내가 한 차단과 나를 향한 차단",
  "만 19세 이상 확인 기록",
];
const KEPT = [
  ["지난 방문·예약 기록", "매장의 매출과 직원 정산에 쓰인 기록이라 남아요. 닉네임은 '탈퇴한 손님'으로 바뀌어 누구인지 알 수 없어요. 매장이 해지하면 90일 뒤 함께 지워져요."],
  ["신고 기록", "안전 문제를 확인하려고 처리 후 1년 동안 보관해요. 신고한 사람과 당한 사람 이름은 익명으로 바뀌어요."],
];

export default function AccountDeletionPage() {
  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Account Deletion</div>
        <h1 className="mt-1 font-serif text-[24px] font-bold text-ink">계정 삭제</h1>
        <p className="mt-2 text-[13px] leading-[1.8] text-mute">
          캐치걸로 만든 매장 앱의 손님 계정은 누구의 허락 없이도 직접 지울 수 있어요. 지우는 즉시 처리되고, 되돌릴 수 없어요.
        </p>

        <section className="mt-6 rounded-[24px] bg-card p-6 shadow-card">
          <h2 className="text-[14px] font-bold text-ink">1. 앱에서 지우기</h2>
          <ol className="mt-2 flex flex-col gap-1.5 text-[12px] leading-[1.8] text-mute">
            <li>① 매장 앱을 열고 아래 탭에서 <b className="text-ink">마이</b>로 가요.</li>
            <li>② 맨 아래 <b className="text-ink">계정 삭제</b>의 삭제하기를 눌러요.</li>
            <li>③ PIN을 넣고, 확인 칸에 삭제라고 적은 뒤 계정 삭제를 눌러요.</li>
          </ol>
        </section>

        <section className="mt-4 rounded-[24px] bg-card p-6 shadow-card">
          <h2 className="text-[14px] font-bold text-ink">2. 앱 없이 여기서 지우기</h2>
          <p className="mt-1 mb-4 text-[12px] leading-[1.8] text-mute">
            앱을 지웠거나 휴대폰을 바꿨다면 매장 주소, 닉네임, PIN으로 여기서 바로 지울 수 있어요.
            PIN을 {PIN_MAX_FAILS}번 틀리면 {PIN_LOCK_MINUTES}분 동안 잠겨요. PIN이 기억나지 않으면 매장에서 새 연결코드를 받아 PIN을 다시 정한 뒤 지우시면 돼요.
          </p>
          <DeletionForm />
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] bg-card p-6 shadow-card">
            <h2 className="text-[14px] font-bold text-ink">바로 지워지는 것</h2>
            <ul className="mt-2 flex flex-col gap-1 text-[12px] leading-[1.8] text-mute">
              {DELETED.map((d) => <li key={d}>· {d}</li>)}
              <li>· 앞으로 잡힌 예약은 취소돼요</li>
            </ul>
          </div>
          <div className="rounded-[24px] bg-card p-6 shadow-card">
            <h2 className="text-[14px] font-bold text-ink">남는 것</h2>
            <ul className="mt-2 flex flex-col gap-2 text-[12px] leading-[1.8] text-mute">
              {KEPT.map(([t, d]) => (
                <li key={t}><b className="text-ink">{t}</b> · {d}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-4 rounded-[24px] bg-card p-6 shadow-card">
          <h2 className="text-[14px] font-bold text-ink">직원 · 매장 관리자 · 영업 파트너</h2>
          <p className="mt-1 text-[12px] leading-[1.8] text-mute">
            직원 계정은 매장 관리자가 직원 관리에서 지워요. 매장 관리자와 영업 파트너 계정은 운영사에 요청하시면 10일 안에 지워요.
            <br />
            텔레그램 <a href={`https://t.me/${OPERATOR_CONTACT.telegram}`} className="font-bold text-brand">@{OPERATOR_CONTACT.telegram}</a> · 전화{" "}
            <a href={`tel:${OPERATOR_CONTACT.phone.replace(/[^0-9+]/g, "")}`} className="font-bold text-brand">{OPERATOR_CONTACT.phone}</a>
          </p>
        </section>

        <section lang="en" className="mt-4 rounded-[24px] border border-line bg-card p-6">
          <h2 className="text-[13px] font-bold text-ink">In English</h2>
          <p className="mt-1 text-[12px] leading-[1.8] text-mute">
            Customers can delete their account inside the app (My page, bottom of the screen, Delete account) or on this page without the app,
            using the venue address, nickname and PIN. Deletion is immediate. Deleted: nickname, PIN, reviews, comments, favorites, votes,
            unused coupons, venue notes, blocks and the age confirmation record. Upcoming bookings are cancelled. Kept: past booking records,
            anonymized, as the venue&apos;s sales records until the venue closes its contract plus 90 days, and report records, anonymized, for one year.
            Staff accounts are removed by the venue admin. Venue admins and sales partners can ask the operator on Telegram @{OPERATOR_CONTACT.telegram}.
          </p>
        </section>

        <div className="mt-6 text-[11px] leading-[1.8] text-mute">
          개인정보를 어떻게 다루는지는 <Link href="/platform/privacy" className="font-bold text-brand underline-offset-2 hover:underline">개인정보처리방침</Link>에 있어요.
          <br />
          <Link href="/" className="underline-offset-2 hover:underline">← 캐치걸 홈</Link>
        </div>
      </div>
    </div>
  );
}
