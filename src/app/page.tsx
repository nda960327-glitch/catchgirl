import Link from "next/link";
import type { Metadata } from "next";
import { DISCOUNT_LABEL, PLANS, SETUP_FEE, billedPrice, yearlyPrice, type Plan } from "@/lib/plans";
import { OPERATOR_CONTACT, TERMS_VERSION } from "@/lib/terms";
import { won } from "@/lib/utils";

/**
 * catchgirl.kr 홈 — 앱을 파는 페이지.
 *
 * 매장 서브도메인(bgt.catchgirl.kr)은 미들웨어가 매장 경로로 바꿔 주므로
 * 여기는 루트 도메인으로 들어온 사람만 본다. 로그인 없이 열린다.
 * 화면 캡처는 public/landing 에 있고, 샘플 매장(secret-garden)에서 찍었다.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "캐치걸 — 전화로 받던 예약, 손님이 앱에서 직접",
  description:
    "기존 손님만 초대해 쓰는 매장 전용 전담 매니저(바텐더) 예약 앱. 손님 실명·전화번호를 받지 않고, 사업자 확인을 거친 매장만 씁니다. 예약·출근·룸 배치·수금·재방문 관리까지 한 번에.",
  openGraph: { title: "캐치걸 — 매장 전용 전담 매니저 예약 앱", description: "전화 대신 앱으로. 손님 DB 없이 닉네임으로. 사업자 확인 후 승인.", type: "website" },
};

const DEMO = { url: "https://secret-garden.catchgirl.kr", nickname: "서준", pin: "1234", code: "A3K9" };

/* 해외 예약 서비스 업계 통계 — 업종마다 다르니 "왜 앱이어야 하나" 의 근거로만 쓴다 */
const STATS = [
  { n: "40%", t: "예약의 40%는 영업시간 밖에서 들어와요", d: "전화만 받는 매장은 이 예약을 다음 날로 미루거나 놓쳐요. 앱은 새벽에도 받아요.", src: "SchedulingKit, Online Booking Statistics 2026" },
  { n: "8분 → 1분", t: "전화 예약 8분, 앱 예약 1분", d: "영업 중에 전화 받고 달력 뒤지는 시간이 사라져요. 손님도 빈자리를 보고 바로 잡아요.", src: "Zippia, Appointment Scheduling Statistics" },
  { n: "3.2배", t: "앱으로 예약한 손님은 3.2배 자주 다시 와요", d: "홈 화면에 아이콘이 있으면 다음 예약이 한 번 탭이에요. 방문 기록과 등급 혜택이 그 이유를 만들어 줘요.", src: "SchedulingKit, Mobile Booking Statistics 2026" },
  { n: "48%", t: "예약이 불편하면 절반 가까이 다른 곳으로 가요", d: "안 받는 전화, 늦는 답장이 손님을 잃는 이유예요. 앱은 항상 받고, 항상 답해요.", src: "SimplyBook.me, Online Booking Statistics 2026" },
];

const SOURCES = [
  ["SchedulingKit — Online Booking Statistics 2026", "https://schedulingkit.com/statistics/online-booking-statistics"],
  ["SchedulingKit — Mobile Booking Statistics 2026", "https://schedulingkit.com/statistics/mobile-booking-statistics"],
  ["Zippia — Appointment Scheduling Statistics", "https://www.zippia.com/advice/appointment-scheduling-statistics/"],
  ["SimplyBook.me — Online Booking Statistics 2026", "https://simplybook.me/en/blog/online-booking-statistics"],
];

const FAQ = [
  { q: "전화나 텔레그램으로 예약하는 손님은요?", a: "관리자 화면에서 3초면 대신 넣어요. 닉네임 몇 글자만 치면 기존 손님이 바로 뜨고, 전화·텔레그램·앱 어느 경로로 왔는지도 남아요. 앱을 안 쓰는 손님도 방문 기록은 똑같이 쌓여요." },
  { q: "캐치테이블 같은 예약 앱이랑 뭐가 달라요?", a: "공개 앱이 아니에요. 매장이 준 연결코드가 있는 기존 손님만 들어오고, 주소가 퍼져도 남이 못 써요. 테이블이 아니라 '누가 자리를 맡을지' 를 고르는 예약이고, 출근·룸 배치·수금까지 매장 운영이 한 화면에 있어요." },
  { q: "손님 정보는 어디까지 받나요?", a: "닉네임과 PIN뿐이에요. 실명·전화번호를 넣는 칸 자체가 없어요. 매장이 관리자 메모에 적어 두는 연락처는 관리자만 보고, 손님 화면엔 절대 안 나가요." },
  { q: "앱스토어에서 받나요?", a: "아니요. 매장 주소를 열고 '앱으로 설치' 를 누르면 홈 화면에 매장 로고 아이콘으로 깔려요. 손님·직원·관리자 앱이 따로 있고, 심사 없이 바로 업데이트돼요." },
  { q: "직원이 출근을 자주 펑크 내는데요.", a: "관리자가 요일별 출근 가능 여부를 직접 잡고, 주간표에 예비를 걸어 두면 예비인 사람은 예약이 안 잡혀요. 출근·펑크 기록이 사람마다 남아요." },
  { q: "할인을 주면 직원 몫이 줄어요?", a: "아니요. 쿠폰·등급 혜택·요일 프로모션은 전부 매장 몫에서 빠지고, 직원이 받는 돈은 그대로예요. 수금 시트에 할인이 반영된 금액이 바로 나와요." },
  { q: "해지하면요?", a: "위약금 없이 언제든 해지할 수 있어요. 손님 화면이 먼저 닫히고 관리자 화면은 90일 더 열려 있어서 기록을 내려받을 수 있어요. 그 뒤엔 데이터를 지워요." },
];

function Phone({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative w-[220px] shrink-0 overflow-hidden rounded-[34px] border-[6px] border-ink/90 bg-ink shadow-pop ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  );
}

function Desktop({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-pop">
      <div className="flex items-center gap-1.5 border-b border-line bg-well px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-bad/60" /><span className="h-2.5 w-2.5 rounded-full bg-gold/70" /><span className="h-2.5 w-2.5 rounded-full bg-ok/60" />
        <span className="ml-2 rounded-md bg-card px-2 py-0.5 font-mono text-[9px] text-mute">secret-garden.catchgirl.kr/admin</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  );
}

export default function Home() {
  const plans = Object.keys(PLANS) as Plan[];
  return (
    <div className="min-h-dvh bg-frame text-ink">
      {/* 상단 */}
      <header className="sticky top-0 z-20 border-b border-line/60 bg-frame/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icon-customer-192.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-serif text-[18px] font-bold">캐치걸</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-5 text-[12px] font-semibold text-mute md:flex">
            <a href="#why" className="hover:text-ink">왜 앱인가</a>
            <a href="#features" className="hover:text-ink">기능</a>
            <a href="#privacy" className="hover:text-ink">손님 정보</a>
            <a href="#legal" className="hover:text-ink">합법 운영</a>
            <a href="#pricing" className="hover:text-ink">가격</a>
            <a href="#install" className="hover:text-ink">설치·샘플</a>
            <a href="#faq" className="hover:text-ink">자주 묻는 질문</a>
          </nav>
          <Link href="/signup" className="cta-grad rounded-xl px-4 py-2 text-[12px] font-bold text-white shadow-cta">가입 신청</Link>
        </div>
      </header>

      {/* 히어로 */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Catchgirl · 매장 전용 전담 매니저 예약 앱</div>
          <h1 className="mt-3 font-serif text-[34px] font-bold leading-[1.25] md:text-[46px]">
            전화로 받던 예약,<br />이제 손님이 앱에서 직접 잡아요
          </h1>
          <p className="mt-5 max-w-xl text-[14px] leading-[1.9] text-mute">
            기존 손님만 초대해 쓰는 우리 매장 전용 앱이에요. 손님이 자리를 맡을 전담 매니저(바텐더)를 고르고 시간을 잡으면, 매장에는 알림이 오고 방문 기록이 쌓여요.
            머리 아픈 정산도, 밤늦은 전화도 앱이 대신해요. <b className="text-ink">손님의 실명과 전화번호는 처음부터 받지 않아요.</b>
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link href="/signup" className="cta-grad rounded-2xl px-6 py-3.5 text-[14px] font-bold text-white shadow-cta">가입 신청하기</Link>
            <a href="#install" className="rounded-2xl border border-line bg-card px-6 py-3.5 text-[14px] font-bold text-ink hover:border-brand">샘플 매장 둘러보기</a>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-ok-bg px-3 py-1.5 text-ok">사업자등록증 확인 후 승인</span>
            <span className="rounded-full bg-ok-bg px-3 py-1.5 text-ok">손님 실명·번호 수집 없음</span>
            <span className="rounded-full bg-blush-lt px-3 py-1.5 text-brand">초대받은 손님만</span>
          </div>
        </div>
        <div className="flex justify-center gap-4 md:justify-end">
          <Phone src="/landing/c-list.png" alt="손님 앱 — 캐치걸 고르기" className="mt-10 hidden sm:block" />
          <Phone src="/landing/c-home.png" alt="손님 앱 홈" />
        </div>
      </section>

      {/* 왜 앱인가 */}
      <section id="why" className="border-y border-line/60 bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Why an app</div>
          <h2 className="mt-2 font-serif text-[26px] font-bold md:text-[32px]">솔직히, 요즘 누가 전화로 시켜요</h2>
          <p className="mt-3 max-w-2xl text-[13px] leading-[1.9] text-mute">
            배달도 택시도 앱인데 예약만 전화면 손님이 먼저 지쳐요. 예약 서비스 업계에서 되풀이해 나오는 숫자들이에요. 업종과 매장마다 다르지만 방향은 같아요.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.n} className="rounded-[22px] bg-card p-5 shadow-card">
                <div className="font-serif text-[30px] font-bold text-brand">{s.n}</div>
                <div className="mt-1 text-[13px] font-bold">{s.t}</div>
                <p className="mt-2 text-[11px] leading-[1.8] text-mute">{s.d}</p>
                <div className="mt-3 text-[9px] text-mute/80">{s.src}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              ["계산 안 해도 돼요", "시간·옵션·할인·매장 몫·직원 몫이 자동으로 나뉘어요. 수금 시트를 들고 방마다 돌면 끝이에요."],
              ["재방문이 늘어요", "방문 횟수로 신규·단골·VIP 등급이 붙고 혜택이 자동으로 적용돼요. 즐겨찾기한 사람이 오늘 출근했는지 손님이 먼저 봐요."],
              ["누가 왔는지 남아요", "전화·텔레그램·앱 어느 경로로 왔는지, 누구 소개인지, 몇 번째 방문인지. 감이 아니라 기록으로 매장을 봐요."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-[22px] border border-line bg-card p-5">
                <div className="text-[14px] font-bold">{t}</div>
                <p className="mt-1.5 text-[12px] leading-[1.8] text-mute">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 기능 */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Features</div>
        <h2 className="mt-2 font-serif text-[26px] font-bold md:text-[32px]">앱 세 개, 매장 하나</h2>
        <p className="mt-3 max-w-2xl text-[13px] leading-[1.9] text-mute">손님·직원·관리자가 각자 자기 앱을 깔아요. 모두 같은 매장 데이터를 보고, 매장 로고와 색으로 꾸며져요.</p>

        {/* 손님 */}
        <div className="mt-12 grid items-center gap-10 md:grid-cols-[1fr_1.1fr]">
          <div>
            <div className="inline-block rounded-full bg-blush-lt px-3 py-1 text-[11px] font-bold text-brand">손님 앱</div>
            <h3 className="mt-3 font-serif text-[22px] font-bold">보고, 고르고, 세 번 탭</h3>
            <ul className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.8] text-mute">
              <li><b className="text-ink">프로필로 비교해요.</b> 키·몸무게·흡연·문신처럼 미리 알고 싶은 것과 매장이 정한 항목(외국어 등)을 칩으로 보고, 중고차 고르듯 조건 검색·정렬로 좁혀요.</li>
              <li><b className="text-ink">지금 되는 사람이 보여요.</b> 오늘 출근한 사람, 지금 바로 되는 사람, 몇 시간 남았는지가 실시간이에요.</li>
              <li><b className="text-ink">예약은 날짜·시간·옵션.</b> 쿠폰이나 등급 혜택이 있으면 손님이 직접 적용해요. 예약하면 매장에 바로 알림이 가요.</li>
              <li><b className="text-ink">방문 기록이 쌓여요.</b> 내 등급, 다음 혜택, 즐겨찾기, 후기와 추천. 다시 올 이유가 앱 안에 있어요.</li>
            </ul>
          </div>
          <div className="flex justify-center gap-3 overflow-x-auto pb-2">
            <Phone src="/landing/c-profile.png" alt="캐치걸 프로필" className="w-[190px]" />
            <Phone src="/landing/c-book.png" alt="예약 화면" className="w-[190px] mt-8" />
            <Phone src="/landing/c-me.png" alt="내 방문 기록" className="w-[190px] hidden lg:block" />
          </div>
        </div>

        {/* 관리자 */}
        <div className="mt-20">
          <div className="inline-block rounded-full bg-blush-lt px-3 py-1 text-[11px] font-bold text-brand">관리자</div>
          <h3 className="mt-3 font-serif text-[22px] font-bold">오늘 매장이 한 화면에</h3>
          <p className="mt-2 max-w-2xl text-[13px] leading-[1.8] text-mute">타임라인에서 누가 몇 시에 어느 방인지 보고, 새 예약은 알림으로 받아요. 전화·텔레그램으로 온 예약도 닉네임 몇 글자로 3초면 넣어요.</p>
          <div className="mt-6"><Desktop src="/landing/a-dash.png" alt="관리자 대시보드와 오늘 타임라인" /></div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {[
              { img: "/landing/a-schedule.png", t: "출근 · 룸 배치 주간표", d: "요일별 출근 가능 여부를 관리자가 잡고, 주간·야간 조로 방을 배치해요. 예비로 걸어 두면 예약이 안 잡히고, 출근·펑크 기록이 사람마다 남아요." },
              { img: "/landing/a-collect.png", t: "방마다 수금 시트", d: "주간 얼마, 야간 얼마. 시간·옵션·할인이 반영된 받을 금액과 매장 몫·직원 몫이 방 단위로 나와요. 계산기 없이 돌아요." },
              { img: "/landing/a-revenue.png", t: "매출 · 재방문 · 방문 경로", d: "월별 매출, 순이익, 재방문율, 노쇼율, 어디서 온 손님이 오래 남는지. Max 는 CSV 로 내려받아요." },
              { img: "/landing/a-customers.png", t: "손님 관리와 할인", d: "등급·방문 횟수·마지막 방문이 한 줄에. 쿠폰, 단골·VIP 혜택, 비 오는 날 프로모션은 매장 몫에서만 빠지고 직원 몫은 그대로예요." },
            ].map((c) => (
              <div key={c.t}>
                <Desktop src={c.img} alt={c.t} />
                <div className="mt-3 text-[14px] font-bold">{c.t}</div>
                <p className="mt-1 text-[12px] leading-[1.8] text-mute">{c.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 직원 */}
        <div className="mt-20 grid items-center gap-10 md:grid-cols-[1fr_1.1fr]">
          <div className="flex justify-center md:order-2">
            <Phone src="/landing/s-home.png" alt="직원 앱" />
          </div>
          <div className="md:order-1">
            <div className="inline-block rounded-full bg-blush-lt px-3 py-1 text-[11px] font-bold text-brand">직원 앱</div>
            <h3 className="mt-3 font-serif text-[22px] font-bold">내 예약, 받을 돈, 내 몫</h3>
            <ul className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.8] text-mute">
              <li><b className="text-ink">오늘 내 예약이 시간순으로.</b> 몇 시에 어느 방, 무슨 옵션, 손님이 남긴 요청까지.</li>
              <li><b className="text-ink">받을 돈과 내 몫이 따로.</b> 이번 달 순이익과 온 손님 수가 바로 보여요. 매장이 할인을 줘도 내 몫은 안 줄어요.</li>
              <li><b className="text-ink">내 프로필은 내가.</b> 사진, 소개, 제공 옵션, 출근 가능한 요일을 직접 고쳐요. 관리자가 최종으로 잡아요.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 손님 정보 */}
      <section id="privacy" className="border-y border-line/60 bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Privacy by design</div>
            <h2 className="mt-2 font-serif text-[26px] font-bold md:text-[32px]">고객 DB를 만들지 않아요</h2>
            <p className="mt-3 text-[13px] leading-[1.9] text-mute">
              손님이 앱에 남기는 건 <b className="text-ink">닉네임과 PIN</b>뿐이에요. 실명·전화번호를 넣는 칸이 애초에 없어서, 모으고 싶어도 못 모아요.
              유출될 명단이 없다는 게 매장에도 손님에게도 가장 안전한 상태예요.
            </p>
          </div>
          <ul className="grid gap-3 text-[12px] leading-[1.8]">
            {[
              ["연결코드로만 시작", "매장이 준 코드가 있어야 계정이 생겨요. 주소가 퍼져도, 링크를 공유해도 남은 못 들어와요."],
              ["매장 메모는 관리자만", "매장이 손님 연락처를 적어 둘 수 있지만 관리자 화면에서만 보이고 손님 화면엔 나가지 않아요."],
              ["매장별로 완전히 분리", "다른 매장은 우리 손님을 볼 수 없어요. 운영사도 매장 운영에 쓰지 않아요."],
              ["해지하면 지워요", "관리자 화면 90일 뒤 데이터를 삭제해요. 필요하면 그 전에 내려받아요."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-2xl border border-line bg-card p-4">
                <div className="font-bold text-ink">{t}</div>
                <div className="mt-1 text-mute">{d}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 합법 */}
      <section id="legal" className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-[28px] border border-gold/40 bg-card p-6 shadow-card md:p-10">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Compliance</div>
          <h2 className="mt-2 font-serif text-[26px] font-bold md:text-[32px]">합법 매장만, 확인하고 엽니다</h2>
          <p className="mt-3 max-w-3xl text-[13px] leading-[1.9] text-mute">
            캐치걸은 테이블을 맡아 응대할 전담 매니저(바텐더)를 미리 지정해 예약하는 앱이고, 매장 운영을 돕는 소프트웨어예요. 유흥이나 그 밖의 목적을 위한 서비스가 아니에요.
            같은 문장이 모든 매장의 손님 화면에 지울 수 없는 공지로 늘 걸려 있어요.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["1. 사업자등록증 확인", "가입 신청 때 등록증 사본과 사업자등록번호, 업태·종목, 대표자를 받아요. 번호는 국세청 검증번호까지 맞아야 해요."],
              ["2. 국세청 조회 후 승인", "운영사가 홈택스에서 계속사업자인지, 업종이 맞는지 확인한 뒤에야 매장이 열려요. 그 전엔 화면이 잠겨 있어요."],
              ["3. 위반 시 즉시 정지", "성매매 알선·청소년 고용·성적 서비스 광고 등 약관 3항의 행위가 확인되면 사전 통지 없이 바로 닫고, 환불하지 않아요."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-well p-4">
                <div className="text-[13px] font-bold">{t}</div>
                <p className="mt-1.5 text-[12px] leading-[1.8] text-mute">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 text-[12px] text-mute">
            전문은 <Link href="/platform/terms" className="font-bold text-brand underline-offset-2 hover:underline">서비스 이용 약관 ({TERMS_VERSION} 판)</Link>에서 볼 수 있어요.
          </div>
        </div>
      </section>

      {/* 가격 */}
      <section id="pricing" className="border-y border-line/60 bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Pricing</div>
          <h2 className="mt-2 font-serif text-[26px] font-bold md:text-[32px]">요금은 두 가지, 지금은 반값</h2>
          <p className="mt-3 max-w-2xl text-[13px] leading-[1.9] text-mute">{DISCOUNT_LABEL}이 적용된 금액이에요. 한도를 넘겨도 영업 중에 등록이 막히지 않아요. 청구일에 맞는 요금제로 안내만 드려요.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {plans.map((k) => {
              const p = PLANS[k];
              const lim = (n: number | null, unit: string) => (n === null ? "무제한" : `${n.toLocaleString("ko-KR")}${unit}`);
              return (
                <div key={k} className={`rounded-[26px] p-6 shadow-card ${k === "MAX" ? "bg-ink text-on-ink" : "bg-card"}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-[22px] font-bold">{p.name}</span>
                    <span className={`text-[11px] line-through ${k === "MAX" ? "opacity-60" : "text-mute"}`}>{won(p.price)}</span>
                  </div>
                  <div className={`mt-2 font-serif text-[32px] font-bold ${k === "MAX" ? "text-gold-lt" : "text-brand"}`}>
                    {won(billedPrice(k))}<span className={`text-[12px] font-normal ${k === "MAX" ? "opacity-70" : "text-mute"}`}>/월</span>
                  </div>
                  <div className={`mt-1 text-[11px] ${k === "MAX" ? "opacity-70" : "text-mute"}`}>연납 {won(yearlyPrice(k))} (두 달 무료)</div>
                  <p className={`mt-3 text-[12px] leading-[1.7] ${k === "MAX" ? "opacity-80" : "text-mute"}`}>{p.tagline}</p>
                  <ul className={`mt-4 flex flex-col gap-1.5 text-[12px] ${k === "MAX" ? "opacity-90" : "text-ink"}`}>
                    <li>등록 손님 {lim(p.limits.customers, "명")}</li>
                    <li>캐치걸 {lim(p.limits.staff, "명")} · 룸 {lim(p.limits.rooms, "개")}</li>
                    <li>손님·직원·관리자 앱 3개, 매장 로고·테마</li>
                    <li>예약·타임라인·출근 배치·수금·할인·후기</li>
                    <li>{p.dataExport ? "CSV 데이터 내보내기" : "데이터 내보내기 없음"}</li>
                    <li>{p.prioritySupport ? "영업시간 중 우선 지원 · 급한 건 전화" : "영업일 기준 하루 안에 답변"}</li>
                  </ul>
                </div>
              );
            })}
            <div className="rounded-[26px] border border-dashed border-line bg-card p-6">
              <div className="font-serif text-[22px] font-bold">초기 구축</div>
              <div className="mt-2 font-serif text-[32px] font-bold text-brand">{won(SETUP_FEE)}</div>
              <div className="mt-1 text-[11px] text-mute">첫 1회 · 요금제와 별도</div>
              <ul className="mt-4 flex flex-col gap-1.5 text-[12px] text-ink">
                <li>카톡·전화 손님을 연결코드와 함께 이관</li>
                <li>캐치걸 프로필·사진 등록</li>
                <li>룸·주간/야간 시간 세팅</li>
                <li>관리자·직원 사용 교육</li>
                <li>첫 주 붙어서 봐 드려요</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-mute">위약금 없이 언제든 해지할 수 있어요. 결제는 승인 뒤 안내드리고, 신청만으로 요금이 나가지 않아요.</div>
        </div>
      </section>

      {/* 설치·샘플 */}
      <section id="install" className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_1fr]">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Install · Demo</div>
            <h2 className="mt-2 font-serif text-[26px] font-bold md:text-[32px]">앱스토어 없이, 매장 주소에서 설치</h2>
            <p className="mt-3 text-[13px] leading-[1.9] text-mute">
              매장마다 <b className="text-ink">이름.catchgirl.kr</b> 주소가 생겨요. 손님은 그 주소에서, 직원은 <b className="text-ink">/staff</b>, 관리자는 <b className="text-ink">/admin</b>에서 '앱으로 설치'를 누르면 홈 화면에 매장 로고 아이콘으로 깔려요. 큐알 세 장을 콘솔이 만들어 줘요.
            </p>
            <div className="mt-6 rounded-[22px] border border-line bg-card p-5">
              <div className="text-[13px] font-bold">샘플 매장으로 직접 눌러 보세요</div>
              <p className="mt-1 text-[12px] leading-[1.8] text-mute">10년치 예약·손님·매출이 들어 있는 예시 매장이에요. 손님 앱은 아래 계정으로 바로 들어가요.</p>
              <div className="mt-3 rounded-xl bg-well px-3 py-2.5 font-mono text-[12px] leading-[1.9]">
                주소   {DEMO.url}<br />
                닉네임 {DEMO.nickname} · PIN {DEMO.pin}<br />
                연결코드 {DEMO.code} (새 계정으로 시작해 보고 싶을 때)
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`${DEMO.url}/login`} target="_blank" rel="noreferrer" className="cta-grad rounded-xl px-4 py-2.5 text-[12px] font-bold text-white shadow-cta">샘플 손님 앱 열기 ↗</a>
                <a href={`https://t.me/${OPERATOR_CONTACT.telegram}`} target="_blank" rel="noreferrer" className="rounded-xl border border-line bg-card px-4 py-2.5 text-[12px] font-bold hover:border-brand">관리자 화면 시연 요청</a>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-3">
            <Phone src="/landing/c-home.png" alt="손님 앱" className="w-[180px] mt-8" />
            <Phone src="/landing/s-home.png" alt="직원 앱" className="w-[180px]" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-line/60 bg-card/60">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">FAQ</div>
          <h2 className="mt-2 font-serif text-[26px] font-bold md:text-[32px]">자주 묻는 질문</h2>
          <div className="mt-6 flex flex-col gap-2">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-line bg-card px-5 py-4">
                <summary className="cursor-pointer list-none text-[14px] font-bold">
                  <span className="mr-2 text-brand">Q.</span>{f.q}
                </summary>
                <p className="mt-2 text-[13px] leading-[1.9] text-mute">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 마무리 CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16 text-center">
        <h2 className="font-serif text-[26px] font-bold md:text-[34px]">오늘 밤부터 전화 대신 앱으로</h2>
        <p className="mx-auto mt-3 max-w-xl text-[13px] leading-[1.9] text-mute">신청서를 내면 사업자 확인 뒤 보통 영업일 하루 안에 연락드려요. 초기 세팅부터 첫 주까지 같이 봐 드려요.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link href="/signup" className="cta-grad rounded-2xl px-7 py-3.5 text-[14px] font-bold text-white shadow-cta">가입 신청하기</Link>
          <a href={`https://t.me/${OPERATOR_CONTACT.telegram}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-line bg-card px-7 py-3.5 text-[14px] font-bold hover:border-brand">텔레그램으로 문의</a>
        </div>
      </section>

      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-5 py-8 text-[11px] text-mute">
          <div>
            <div className="font-serif text-[15px] font-bold text-ink">캐치걸</div>
            <div className="mt-1">매장 전용 전담 매니저(바텐더) 예약·운영 소프트웨어</div>
            <div className="mt-2">
              텔레그램 <a href={`https://t.me/${OPERATOR_CONTACT.telegram}`} className="font-bold text-brand">@{OPERATOR_CONTACT.telegram}</a> · 전화 <a href={`tel:${OPERATOR_CONTACT.phone.replace(/[^0-9+]/g, "")}`} className="font-bold text-brand">{OPERATOR_CONTACT.phone}</a>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Link href="/signup" className="hover:text-ink">가입 신청</Link>
            <Link href="/platform/terms" className="hover:text-ink">이용 약관</Link>
            <Link href="/platform" className="hover:text-ink">운영사 콘솔</Link>
          </div>
          <div className="max-w-sm">
            <div className="font-bold text-ink">통계 출처</div>
            <ul className="mt-1 flex flex-col gap-0.5">
              {SOURCES.map(([t, u]) => (
                <li key={u}><a href={u} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{t}</a></li>
              ))}
            </ul>
            <div className="mt-2 text-[10px] text-mute/80">해외 예약 서비스 업계 통계예요. 업종과 매장에 따라 결과는 달라요.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
