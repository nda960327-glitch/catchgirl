import Link from "next/link";
import type { Metadata } from "next";
import { OPERATOR_CONTACT } from "@/lib/terms";

/**
 * 시연 안내 — 시연을 요청한 업체에 링크 하나로 보내는 페이지.
 * 홈 메뉴에는 걸지 않는다. 샘플 매장의 계정이 그대로 적혀 있으니 요청한 사람에게만 준다.
 */
export const dynamic = "force-static";
export const metadata = { title: "캐치걸 시연 안내", robots: { index: false, follow: false } } satisfies Metadata;

const BASE = "https://secret-garden.catchgirl.kr";

const APPS = [
  {
    key: "customer",
    label: "손님 앱",
    who: "손님이 보는 화면",
    url: `${BASE}`,
    cred: [["닉네임", "길동"], ["PIN", "1234"]],
    device: "모바일로 보세요. 폰에서 열면 '앱으로 설치'가 떠요.",
    tries: [
      "홈에서 오늘 나온 사람 수와 '지금 예약 가능'을 확인해요",
      "예약 탭에서 비흡연·문신 없음·외국어 같은 조건으로 좁혀 보고 정렬을 바꿔요",
      "한 명 골라 프로필·후기를 보고, 날짜·시간·옵션을 골라 예약까지 눌러 보세요",
      "마이에서 방문 기록과 등급(신규·단골·VIP), 혜택을 확인해요",
    ],
  },
  {
    key: "admin",
    label: "관리자",
    who: "사장·실장이 보는 화면",
    url: `${BASE}/admin`,
    cred: [["이메일", "admin@catchgirl.app"], ["비밀번호", "1234"]],
    device: "PC 브라우저로 보면 가장 잘 보여요. 모바일에서도 그대로 열려요.",
    tries: [
      "대시보드의 오늘 타임라인 — 누가 몇 시에 어느 방인지, 옆으로 밀어 보세요",
      "예약 관리 › '+ 예약 등록' 으로 전화 예약을 닉네임 몇 글자로 넣어 보세요",
      "직원 관리 › 출근·룸 배치에서 주간표와 예비를 보세요",
      "수금에서 방마다 주간·야간 받을 금액이 자동으로 나오는 걸 확인해요",
      "매출 관리와 방문 경로에서 재방문율·노쇼율·경로별 성과를 보세요",
      "할인 관리에서 쿠폰·등급 혜택·요일 프로모션을 보세요 (직원 몫은 안 줄어요)",
    ],
  },
  {
    key: "staff",
    label: "직원 앱",
    who: "캐치걸(직원)이 보는 화면",
    url: `${BASE}/staff`,
    cred: [["아이디", "junhee"], ["비밀번호", "1234"]],
    device: "모바일로 보세요.",
    tries: [
      "오늘 내 예약이 시간순으로 뜨는 걸 확인해요",
      "이번 달 받을 돈·내 몫·순이익을 보세요",
      "내 설정에서 사진·소개·제공 옵션·출근 가능 요일을 직접 고칠 수 있어요",
    ],
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-dvh bg-frame text-ink">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Demo</div>
        <h1 className="mt-1 font-serif text-[26px] font-bold">캐치걸 시연 안내</h1>
        <p className="mt-2 text-[13px] leading-[1.9] text-mute">
          10년치 예약·손님·매출이 들어 있는 <b className="text-ink">샘플 매장</b>이에요. 아래 계정으로 세 앱을 모두 열어 볼 수 있어요.
          마음껏 눌러 보셔도 돼요. 시연용 데이터라 실제 매장과는 관계없어요.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {APPS.map((a) => (
            <section key={a.key} className="rounded-[24px] bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-serif text-[18px] font-bold">{a.label}</h2>
                <span className="text-[11px] text-mute">{a.who}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="rounded-xl bg-well px-3.5 py-3 font-mono text-[12px] leading-[1.9]">
                  <a href={a.url} target="_blank" rel="noreferrer" className="font-bold text-brand underline-offset-2 hover:underline">{a.url}</a>
                  {a.cred.map(([k, v]) => (
                    <div key={k}><span className="text-mute">{k}</span> {v}</div>
                  ))}
                </div>
                <a href={a.url} target="_blank" rel="noreferrer" className="cta-grad self-start rounded-xl px-4 py-2.5 text-center text-[12px] font-bold text-white shadow-cta">열기 ↗</a>
              </div>
              <div className="mt-2.5 text-[11px] font-semibold text-ink">{a.device}</div>
              <ul className="mt-2 flex flex-col gap-1 text-[12px] leading-[1.7] text-mute">
                {a.tries.map((t) => (
                  <li key={t} className="flex gap-2"><span className="text-brand">›</span><span>{t}</span></li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-6 rounded-[24px] border border-line bg-card p-5 text-[12px] leading-[1.8] text-mute">
          <div className="text-[13px] font-bold text-ink">보시다가 궁금한 건</div>
          텔레그램 <a href={`https://t.me/${OPERATOR_CONTACT.telegram}`} target="_blank" rel="noreferrer" className="font-bold text-brand">@{OPERATOR_CONTACT.telegram}</a> 또는 전화 <a href={`tel:${OPERATOR_CONTACT.phone.replace(/[^0-9+]/g, "")}`} className="font-bold text-brand">{OPERATOR_CONTACT.phone}</a>로 바로 물어보세요.
          <br />
          실제 매장을 열려면 <Link href="/signup" className="font-bold text-brand underline-offset-2 hover:underline">가입 신청</Link>에서 사업자등록증과 함께 신청해 주세요. 확인 뒤 보통 영업일 하루 안에 열려요.
          가격과 정책은 <Link href="/#pricing" className="font-bold text-brand underline-offset-2 hover:underline">홈페이지</Link>에 있어요.
        </div>
      </div>
    </div>
  );
}
