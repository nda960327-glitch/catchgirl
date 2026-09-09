import Link from "next/link";
import type { Metadata } from "next";
import { DEBIT_DAY, ONSITE_SETUP_FEE, PLANS, TERM_MONTHS, termDiscountPercent, type Plan } from "@/lib/plans";
import { PricingTable } from "@/components/pricing-table";
import { RevisitCalculator } from "@/components/revisit-calculator";
import { ThemeGallery } from "@/components/theme-gallery";
import { InviteCard } from "@/components/invite-card";
import { InstallPoster } from "@/components/install-poster";
import QRCode from "qrcode";
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

/* 재방문이 왜 매출인지 — 널리 인용되는 연구. 우리 앱 수치가 아니라 업계 연구라고 밝힌다 */
const RETENTION_STATS = [
  { n: "25~95%", t: "재방문율 5%p 오르면 이익은 25~95% 늘어요", d: "새 손님 한 명 데려오는 비용은 비싸고, 다시 오는 손님은 광고비가 들지 않아요.", src: "Bain & Company · Harvard Business Review" },
  { n: "67%", t: "단골은 처음 온 손님보다 67% 더 써요", d: "익숙한 자리, 아는 사람, 쌓인 혜택. 오래 온 손님일수록 한 번에 더 오래, 더 많이 써요.", src: "Bain & Company" },
  { n: "3.2배", t: "앱을 깐 손님은 3.2배 자주 다시 예약해요", d: "홈 화면 아이콘이 있는 매장과 브라우저로 찾아야 하는 매장의 차이예요.", src: "SchedulingKit, Mobile Booking Statistics 2026" },
];

const RETENTION_HOOKS = [
  ["홈 화면에 우리 매장 아이콘", "설치한 순간부터 손님 폰에 자리가 생겨요. 다음 예약은 두 번 탭이고, 전화번호 없이도 손님과 연결된 유일한 통로예요."],
  ["즐겨찾기한 사람이 오늘 나왔는지", "손님이 홈을 열면 지명하던 캐치걸의 오늘 출근·남은 시간이 먼저 보여요. '오늘 있네' 가 그대로 예약이 돼요."],
  ["5번째부터 단골, 10번째부터 VIP", "방문 횟수로 등급이 자동으로 붙고 혜택이 예약할 때 바로 적용돼요. 손님은 '몇 번 더 오면 VIP' 를 마이 화면에서 봐요."],
  ["쿠폰과 요일 프로모션", "비 오는 날 3만원, 착한 손님 쿠폰, 조용한 요일 혜택. 문자 없이 손님 앱에 떠요. 할인은 매장 몫에서만 빠지고 직원 몫은 그대로예요."],
  ["후기·추천이 쌓여요", "손님이 남긴 후기와 추천에 매장이 답글을 달아요. 다음에 올 이유가 앱 안에 기록으로 남아요."],
  ["재방문율이 매달 숫자로", "관리자 화면에 재방문율·재방문 손님 수·오래 안 온 손님이 그대로 떠요. 감이 아니라 숫자로 보고, 안 오는 단골에게 먼저 연락해요."],
];

const CUSTOMIZABLE = [
  ["매장 이름 · 로고 · 앱 아이콘", "로고 한 장 올리면 손님·직원·관리자 앱 아이콘이 그 로고로 깔려요"],
  ["직원 호칭", "캐치걸·매니저·바텐더, 뭐라고 부르든 그 말로. 손님·직원·관리자 화면 문구 전체가 따라와요"],
  ["테마 5종 + 메인 컬러", "밝은 로즈·크림, 어두운 누아르·와인·미드나이트. 색 하나 고르면 화면 전체가 따라가요"],
  ["프로필 항목", "키·몸무게·흡연·문신 외에 성형 여부, 외국어 같은 항목을 매장이 직접 만들어요. 손님 검색 조건으로도 붙어요"],
  ["옵션 이름과 가격", "옵션1·옵션2 이름과 금액을 매장이 정해요"],
  ["등급 혜택 · 쿠폰 · 요일 프로모션", "단골·VIP 금액, 비 오는 날 할인, 착한 손님 쿠폰"],
  ["룸 이름 · 영업시간 · 교대", "1번 룸을 '달빛룸' 으로, 주간·야간 시간을 매장대로"],
  ["공지 · 방문경로 · 문의 연락처", "손님 화면 공지, 손님이 어디서 왔는지 항목, 문의 버튼의 전화·텔레그램"],
];

const SOURCES = [
  ["위시켓 — 앱 개발 비용, 2026년 최신 데이터 (의뢰 73,213건)", "https://blog.wishket.com/blog/app-development-cost-data-guide"],
  ["Harvard Business Review — The Value of Keeping the Right Customers (Bain)", "https://hbr.org/2014/10/the-value-of-keeping-the-right-customers"],
  ["Bain & Company — Prescription for cutting costs (Reichheld)", "https://media.bain.com/Images/BB_Prescription_cutting_costs.pdf"],
  ["SchedulingKit — Online Booking Statistics 2026", "https://schedulingkit.com/statistics/online-booking-statistics"],
  ["SchedulingKit — Mobile Booking Statistics 2026", "https://schedulingkit.com/statistics/mobile-booking-statistics"],
  ["Zippia — Appointment Scheduling Statistics", "https://www.zippia.com/advice/appointment-scheduling-statistics/"],
  ["SimplyBook.me — Online Booking Statistics 2026", "https://simplybook.me/en/blog/online-booking-statistics"],
];

/* 전화·수첩으로 돌던 매장과 캐치걸을 쓰는 매장 — 관리자의 같은 하루 */
const BEFORE_AFTER = [
  ["예약 받기", "새벽까지 전화·카톡을 붙들고, 놓친 건 다음 날 확인", "손님이 앱에서 빈자리를 보고 직접 잡아요. 관리자는 알림만 확인"],
  ["오늘 누가 나오나", "단톡방에 다시 물어보고, 답 없는 사람은 전화", "주간표에 관리자가 직접 잡아 둔 대로. 예비는 예약이 안 잡혀요"],
  ["방 배치", "칠판·메모지, 겹치면 현장에서 조정", "타임라인에서 누가 몇 시에 어느 방인지 한눈에. 겹치면 앱이 막아요"],
  ["수금", "계산기 두드리고 수첩에 적고, 틀리면 다시", "방마다 수금 시트. 시간·옵션·할인 반영된 금액이 자동으로"],
  ["직원 정산", "마감 후 엑셀, 할인 준 날은 더 복잡", "받을 돈·매장 몫·직원 몫이 예약마다 나뉘어요. 할인은 매장 몫에서만"],
  ["단골 구분", "얼굴과 기억에 의존", "방문 횟수로 신규·단골·VIP 자동. 마지막 방문일까지"],
  ["노쇼·펑크", "그냥 당하고, 누가 자주 그러는지 감으로", "손님 노쇼율·직원 펑크율이 사람마다 기록. 블랙리스트 표시"],
  ["손님 명단", "폰 연락처에 실명·번호가 쌓여 불안", "닉네임만. 유출될 명단 자체가 없어요"],
];

const DAY = [
  ["12:00", "출근하자마자 오늘 타임라인", "누가 몇 시에 어느 방인지 이미 잡혀 있어요. 밤새 들어온 예약도 그 위에 있어요."],
  ["15:30", "새 예약 알림", "손님이 앱에서 잡으면 관리자 화면에 알림이 와요. 전화 예약은 닉네임 몇 글자로 3초 입력."],
  ["20:00", "교대 · 야간조 배치", "주간표대로 야간조가 방에 들어가요. 갑자기 빠진 사람은 예비가 대신."],
  ["01:00", "방마다 수금", "수금 시트를 들고 돌아요. 할인·옵션이 반영된 금액이 방마다 적혀 있어요."],
  ["04:00", "마감", "오늘 매출·순이익·직원별 몫이 이미 계산돼 있어요. 내일 예약도 벌써 잡혀 있고요."],
];

const SUPPORT = [
  ["세팅은 직접, 30분이면 끝나요", "룸·조 시간·옵션은 신청서에서 이미 들어가요. 대시보드에 '문 열기 전에 채워 두세요' 목록이 떠서 로고·캐치걸·출근 요일·손님 옮기기를 순서대로 눌러 채우면 끝이에요. 그래서 구축비가 없어요."],
  ["손님은 붙여 넣기 한 번", "카톡·전화로 관리하던 손님 닉네임을 한 줄에 한 명씩 붙여 넣으면 연결코드가 한꺼번에 나와요. 큐알 세 장도 매장 설정에서 바로 인쇄해요."],
  ["첫 주는 붙어서, 방문 세팅은 선택", "문 여는 첫 주에는 텔레그램으로 바로바로 답하고, 필요하면 관리자로 대신 들어가 손봐 드려요. 직접 와서 사진 촬영·명단 정리·직원 교육까지 하루에 끝내는 방문 세팅은 1회 300,000원이에요."],
  ["업데이트는 저절로", "앱스토어 심사가 없어서 고친 기능이 바로 반영돼요. 다른 매장에도 도움이 되는 요청은 요금제와 관계없이 만들어 드려요."],
  ["기록은 매일 보관", "예약·매출·손님 기록은 매일 백업돼요. 해지해도 90일은 관리자 화면에서 내려받을 수 있어요."],
  ["Max 는 우선 지원", "영업시간 중 먼저 처리하고, 급한 건 전화로 받아요. 예약이 안 되거나 화면이 안 열리는 문제는 요금제와 관계없이 가장 먼저예요."],
];

const CHECKLIST = [
  "영업 중에 전화를 못 받아 예약을 놓친 적이 있다",
  "오늘 누가 나오는지 단톡방에 다시 물어본 적이 있다",
  "수금 계산이 틀려서 다시 센 적이 있다",
  "직원이 펑크 내서 예약이 꼬인 적이 있다",
  "이 손님이 단골인지 신규인지 헷갈린 적이 있다",
  "폰에 손님 실명·번호가 쌓여 있어 찜찜한 적이 있다",
];

const NAV: [string, string][] = [
  ["#why", "왜 앱인가"], ["#own-app", "전용 앱"], ["#revisit", "재방문"], ["#onboard", "찍으면 끝"], ["#pricing", "가격"], ["#install", "샘플"], ["#faq", "FAQ"],
];

const FAQ = [
  { q: "기존 손님한테 앱을 어떻게 깔게 해요?", a: "명함 한 장이에요. 관리자가 손님 닉네임을 붙여 넣으면 연결코드가 나오고, 직원이 카드 빈칸에 코드를 적어 방문 손님에게 건네요. 손님은 QR 찍고 코드만 넣으면 끝이고, 그 순간 환영 쿠폰이 들어가요. 앱스토어에서 받는 앱이 아니라 QR로 바로 열리는 웹앱이라 설치 부담이 없고, 홈 화면 추가는 선택이에요. 지갑에 카드를 넣고 다니다 QR만 찍어도 돼요. 실명·번호는 안 넣고, 안 깔아도 그 손님 기록은 관리자 화면에 이미 있어요. 카드를 잃어버리면 코드만 다시 알려 주면 돼요." },
  { q: "전화나 텔레그램으로 예약하는 손님은요?", a: "관리자 화면에서 3초면 대신 넣어요. 닉네임 몇 글자만 치면 기존 손님이 바로 뜨고, 전화·텔레그램·앱 어느 경로로 왔는지도 남아요. 앱을 안 쓰는 손님도 방문 기록은 똑같이 쌓여요." },
  { q: "우리 매장만의 앱인가요? 개발사에 맡긴 거랑 뭐가 달라요?", a: "받는 건 같아요. 매장 이름·로고·앱 아이콘·전용 주소·우리 매장만의 데이터로 된 손님·직원·관리자 앱 세 개. 손님 폰에는 우리 매장 로고로 깔려요. 다른 건 만드는 방식이에요. 엔진은 이미 만들어져 있고 매장 것(이름·로고·테마·손님·직원)만 새로 만들어서, 6,000만원과 3~6개월 대신 0원과 당일이 돼요. 그래서 큰 회사만 갖던 앱을 동네 매장도 초기 투자 없이 가져요." },
  { q: "정말 재방문이 늘어요?", a: "장치는 여섯 개예요. 홈 화면 아이콘, 즐겨찾기한 사람의 오늘 출근 표시, 5회·10회 자동 등급 혜택, 쿠폰·요일 프로모션, 후기·추천, 그리고 재방문율을 매달 숫자로 보는 관리자 화면. 업계 연구로는 재방문율 5%p가 이익 25~95%로 이어지고, 우리 앱에서는 관리자 화면에서 매달 직접 확인할 수 있어요. 안 늘면 어디서 막히는지가 보여요." },
  { q: "캐치테이블 같은 예약 앱이랑 뭐가 달라요?", a: "공개 앱이 아니에요. 매장이 준 연결코드가 있는 기존 손님만 들어오고, 주소가 퍼져도 남이 못 써요. 테이블이 아니라 '누가 자리를 맡을지' 를 고르는 예약이고, 출근·룸 배치·수금까지 매장 운영이 한 화면에 있어요." },
  { q: "손님 정보는 어디까지 받나요?", a: "닉네임과 PIN뿐이에요. 실명·전화번호를 넣는 칸 자체가 없어요. 매장이 관리자 메모에 적어 두는 연락처는 관리자만 보고, 손님 화면엔 절대 안 나가요." },
  { q: "앱스토어에서 받나요?", a: "아니요. 매장 주소를 열고 '앱으로 설치' 를 누르면 홈 화면에 매장 로고 아이콘으로 깔려요. 손님·직원·관리자 앱이 따로 있고, 심사 없이 바로 업데이트돼요." },
  { q: "직원이 출근을 자주 펑크 내는데요.", a: "관리자가 요일별 출근 가능 여부를 직접 잡고, 주간표에 예비를 걸어 두면 예비인 사람은 예약이 안 잡혀요. 출근·펑크 기록이 사람마다 남아요." },
  { q: "할인을 주면 직원 몫이 줄어요?", a: "아니요. 쿠폰·등급 혜택·요일 프로모션은 전부 매장 몫에서 빠지고, 직원이 받는 돈은 그대로예요. 수금 시트에 할인이 반영된 금액이 바로 나와요." },
  { q: "세팅은 누가 해요?", a: "매장이 직접 해요. 룸·조 시간·옵션은 신청서에서 이미 들어가고, 승인되면 대시보드에 '문 열기 전에 채워 두세요' 목록이 떠요. 로고 올리기, 캐치걸 등록, 출근 요일, 손님 옮기기(닉네임 붙여 넣기)까지 30분이면 끝나요. 그래서 구축비가 없어요. 직접 와서 해 드리는 방문 세팅은 선택이고 1회 30만원이에요." },
  { q: "결제는 어떻게 해요?", a: "CMS 자동이체예요. 승인되면 운영사가 출금 동의 링크를 보내고, 사장님이 링크에서 계좌를 등록하면 끝이에요. 매월 5일에 매장 계좌에서 자동으로 빠지고, 첫 출금은 만원이에요. 카드번호를 부르거나 매달 송금할 일이 없어요." },
  { q: "약정이 부담돼요.", a: "무약정도 있어요. Pro 13만원, Max 39만원을 매달 내고 언제든 위약금 없이 해지해요. 2년 약정은 23% 싸고 방문 세팅 30만원이 무료인 대신, 중간에 해지하면 그동안 받은 할인(Pro 월 3만원, Max 월 9만원 × 낸 달 수)과 무료로 받은 방문 세팅비만 돌려주시면 돼요. 남은 기간을 다 물리는 게 아니에요." },
  { q: "해지하면요?", a: "무약정은 위약금 없이 언제든, 약정은 받은 할인만 돌려주고 해지해요. 손님 화면이 먼저 닫히고 관리자 화면은 90일 더 열려 있어서 기록을 내려받을 수 있어요. 그 뒤엔 데이터를 지워요." },
];

function Phone({ src, alt, className = "", eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <div className={`relative w-[220px] shrink-0 overflow-hidden rounded-[34px] border-[6px] border-ink/90 bg-ink shadow-pop ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block w-full" style={{ aspectRatio: "780 / 1688" }} loading={eager ? "eager" : "lazy"} />
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
      <img src={src} alt={alt} className="block w-full" style={{ aspectRatio: "2560 / 1600" }} loading="lazy" />
    </div>
  );
}

export default async function Home() {
  const plans = Object.keys(PLANS) as Plan[];
  // 명함 미리보기용 QR — 샘플 매장으로 간다
  const cardQr = await QRCode.toDataURL(DEMO.url, { margin: 1, width: 256, color: { dark: "#1a1216", light: "#FFFFFF" } });
  return (
    <div className="min-h-dvh bg-frame text-ink [word-break:keep-all]">
      <style>{`html{scroll-behavior:smooth}`}</style>
      {/* 상단 */}
      <header className="sticky top-0 z-20 border-b border-line/60 bg-frame/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icon-customer-192.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-serif text-[18px] font-bold">캐치걸</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-6 text-[13px] font-semibold text-mute md:flex">
            {NAV.map(([h, l]) => <a key={h} href={h} className="transition-colors hover:text-ink">{l}</a>)}
          </nav>
          <Link href="/signup" className="cta-grad ml-auto rounded-xl px-4 py-2 text-[12px] font-bold text-white shadow-cta md:ml-0">가입 신청</Link>
          <details className="relative md:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-line bg-card text-[16px] text-ink">☰</summary>
            <div className="absolute right-0 top-11 z-30 flex w-44 flex-col rounded-2xl border border-line bg-card p-2 shadow-pop">
              {NAV.map(([h, l]) => <a key={h} href={h} className="rounded-xl px-3 py-2 text-[13px] font-semibold text-ink hover:bg-well">{l}</a>)}
            </div>
          </details>
        </div>
      </header>

      {/* 히어로 */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Catchgirl · 매장 전용 전담 매니저 예약 앱</div>
          <h1 className="mt-3 font-serif text-[32px] font-bold leading-[1.22] md:text-[46px]">
            전화로 받던 예약,<br />이제 손님이 앱에서<br className="md:hidden" /> 직접 잡아요
          </h1>
          <p className="mt-5 max-w-xl text-[14px] leading-[1.9] text-mute">
            기존 손님만 초대해 쓰는 우리 매장 전용 앱이에요. 손님이 자리를 맡을 전담 매니저(바텐더)를 고르고 시간을 잡으면, 매장에는 알림이 오고 방문 기록이 쌓여요.
            머리 아픈 정산도, 밤늦은 전화도 앱이 대신해요. <b className="text-ink">예약이 편해지면 재방문이 늘고, 재방문이 곧 매출이에요.</b> 손님의 실명과 전화번호는 처음부터 받지 않아요.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link href="/signup" className="cta-grad rounded-2xl px-6 py-3.5 text-[14px] font-bold text-white shadow-cta">가입 신청하기</Link>
            <a href="#install" className="rounded-2xl border border-line bg-card px-6 py-3.5 text-[14px] font-bold text-ink hover:border-brand">샘플 매장 둘러보기</a>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-ok-bg px-3 py-1.5 text-ok">사업자등록증 확인 후 승인</span>
            <span className="rounded-full bg-ok-bg px-3 py-1.5 text-ok">손님 실명·번호 수집 없음</span>
            <span className="rounded-full bg-blush-lt px-3 py-1.5 text-brand">초대받은 손님만</span>
            <span className="rounded-full bg-blush-lt px-3 py-1.5 text-brand">우리 매장 로고로 깔리는 앱</span>
          </div>
        </div>
        <div className="flex justify-center gap-4 md:justify-end">
          <Phone src="/landing/c-list.png" alt="손님 앱 — 캐치걸 고르기" className="mt-10 hidden sm:block" />
          <Phone src="/landing/c-home.png" alt="손님 앱 홈" eager />
        </div>
      </section>

      {/* 왜 앱인가 */}
      <section id="why" className="scroll-mt-16 border-y border-line/60 bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Why an app</div>
          <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">솔직히, 요즘 누가 전화로 시켜요</h2>
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
        </div>
      </section>

      {/* 전용 앱 — 6,000만원 vs 10만원 */}
      <section id="own-app" className="scroll-mt-16 border-b border-line/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Your own app</div>
          <h2 className="mt-2 font-serif text-[28px] font-bold leading-[1.25] md:text-[36px]">
            6,000만원짜리 앱을,<br />초기 투자 0원에 월 10만원으로
          </h2>
          <p className="mt-4 max-w-2xl text-[14px] leading-[1.9] text-mute">
            매장 이름·로고·아이콘·주소로 된 <b className="text-ink">우리 매장 앱 세 개</b>를 만들어 드려요. 손님 앱, 직원 앱, 관리자 앱.
            개발사에 맡겨 만든 것과 <b className="text-ink">결과가 같아요.</b> 다른 건 값과 기간뿐이에요. 6,000만원과 3~6개월이, 0원과 당일로.
          </p>

          {/* 숫자 대결 */}
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <div className="rounded-[26px] border border-line bg-card p-6">
              <div className="text-[11px] font-bold uppercase tracking-[.18em] text-mute">개발사에 맡기면</div>
              <div className="mt-2 font-serif text-[36px] font-bold text-ink">6,000만원<span className="text-[14px] font-normal text-mute">부터</span></div>
              <ul className="mt-3 flex flex-col gap-1.5 text-[12px] text-mute">
                <li>· 예약 앱 하나 2,000만~4,000만원, 세 개를 잇는 플랫폼은 3,000만~7,000만원 이상</li>
                <li>· 기획·개발·테스트·심사 3~6개월</li>
                <li>· 서버·유지보수 매달 30만~100만원 따로</li>
                <li>· 기능 하나 고칠 때마다 견적</li>
                <li>· 망하면 개발비는 그대로 날아가요</li>
              </ul>
              <div className="mt-3 text-[10px] text-mute/80">위시켓 2026 앱 개발 비용 데이터 · 의뢰 73,213건 평균 3,270만원</div>
            </div>
            <div className="rounded-[26px] bg-ink p-6 text-on-ink">
              <div className="text-[11px] font-bold uppercase tracking-[.18em] text-gold-lt">캐치걸이면</div>
              <div className="mt-2 font-serif text-[36px] font-bold text-gold-lt">0원<span className="text-[14px] font-normal opacity-70"> 초기 투자 · 월 100,000원</span></div>
              <ul className="mt-3 flex flex-col gap-1.5 text-[12px] opacity-90">
                <li>· 같은 앱 세 개, 우리 매장 로고로 손님 폰에 깔려요</li>
                <li>· 승인 당일 열려요. 첫 달은 무료</li>
                <li>· 서버·DB·매일 백업·업데이트 전부 포함</li>
                <li>· 로고·테마·항목·혜택은 관리자 화면에서 직접, 즉시</li>
                <li>· 안 맞으면 해지해요. 무약정은 위약금 0원</li>
              </ul>
              <div className="mt-4 rounded-xl bg-on-ink/10 p-3 text-[12px]">
                6,000만원을 24개월로 나누면 <b>월 250만원</b>이에요. 캐치걸은 2년 다 써도 <b>240만원</b>. 외주 개발 <b>한 달 치 값</b>으로 2년을 써요.
              </div>
            </div>
          </div>

          {/* 왜 가능한가 */}
          <h3 className="mt-14 font-serif text-[22px] font-bold">어떻게 이 값이 가능해요?</h3>
          <p className="mt-2 max-w-2xl text-[13px] leading-[1.9] text-mute">싸구려라서가 아니에요. 만드는 방식이 달라서예요. 건물을 매장마다 새로 짓는 대신, 다 지어진 건물에 간판과 인테리어를 매장 것으로 바꿔 넣어요.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ["엔진은 한 번만 만들었어요", "예약·타임라인·출근 배치·수금·정산·재방문 분석·할인. 매장이 필요로 하는 기능은 다 같아요. 이건 이미 만들어져 있고, 계속 좋아져요."],
              ["매장마다 새로 만드는 건 껍데기와 데이터", "이름, 로고, 앱 아이콘, 테마, 전용 주소, 손님·직원·룸. 매장 것만 새로 만들어요. 그래서 승인 당일 열려요."],
              ["개발비를 매장들이 나눠 내요", "한 매장이 6,000만원을 혼자 내는 대신, 여러 매장이 월 10만원씩. 그래서 큰 회사만 갖던 앱을 동네 매장도 초기 투자 없이 가져요."],
            ].map(([t, d], i) => (
              <div key={t} className="rounded-[22px] border border-line bg-card p-5">
                <div className="font-mono text-[11px] font-bold text-brand">0{i + 1}</div>
                <div className="mt-1.5 text-[14px] font-bold">{t}</div>
                <p className="mt-1.5 text-[12px] leading-[1.8] text-mute">{d}</p>
              </div>
            ))}
          </div>

          {/* 결과물 비교 */}
          <h3 className="mt-14 font-serif text-[22px] font-bold">받는 건 똑같아요, 내는 건 다르고요</h3>
          <div className="mt-5 overflow-x-auto rounded-[22px] border border-line bg-card shadow-card">
            <table className="w-full min-w-[560px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-line bg-well text-[11px] font-bold text-mute">
                  <th className="px-4 py-3"> </th><th className="px-4 py-3">개발사에 맡기면</th><th className="px-4 py-3 text-brand">캐치걸</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["매장 이름·로고·아이콘의 앱 세 개", "○", "○"],
                  ["매장 전용 주소 (이름.catchgirl.kr)", "○ 도메인 따로 구매", "○ 포함"],
                  ["우리 매장만의 데이터 (다른 매장과 분리)", "○", "○"],
                  ["로고·테마·항목·혜택 바꾸기", "개발자에게 요청 · 건당 견적", "관리자 화면에서 직접 · 즉시"],
                  ["서버 · DB · 매일 백업", "별도 계약 · 매달 청구", "포함"],
                  ["기능 업데이트", "건당 견적 · 앱스토어 심사", "자동 · 무료 · 심사 없음"],
                  ["초기 투자", "6,000만원부터", "0원"],
                  ["월 비용", "유지보수 30만~100만원", "100,000원 (2년 약정)"],
                  ["열리기까지", "3~6개월", "승인 당일"],
                  ["안 맞으면", "개발비는 못 돌려받아요", "무약정은 위약금 0 · 약정은 받은 할인만 반환"],
                ].map(([k, a, b]) => (
                  <tr key={k} className="border-b border-line/60 align-top last:border-0">
                    <td className="px-4 py-2.5 font-bold text-ink">{k}</td>
                    <td className="px-4 py-2.5 text-mute">{a}</td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 스킨 */}
          <h3 className="mt-14 font-serif text-[22px] font-bold">스킨 다섯 벌, 로고 한 장이면 우리 매장 앱</h3>
          <p className="mt-2 max-w-2xl text-[13px] leading-[1.9] text-mute">로고를 올리면 앱 아이콘과 화면 색이 그 로고를 따라가요. 테마를 고르고 메인 컬러를 바꾸면 화면 전체가 같이 바뀌어요. 어두운 테마는 캐릭터 대신 매장 로고가 들어가요.</p>
          <div className="mt-6"><ThemeGallery /></div>

          <h3 className="mt-14 font-serif text-[22px] font-bold">코드 없이 매장이 직접 바꾸는 것</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {CUSTOMIZABLE.map(([t, d]) => (
              <div key={t} className="rounded-[22px] border border-line bg-card p-4">
                <div className="text-[13px] font-bold">{t}</div>
                <p className="mt-1.5 text-[11px] leading-[1.8] text-mute">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-mute">전부 관리자 화면에서 바꾸고 즉시 반영돼요. 더 필요한 건 말씀하세요. 다른 매장에도 도움이 되는 건 요금제와 관계없이 만들어 드려요.</div>

          {/* 안 할 이유 */}
          <div className="mt-14 grid gap-4 md:grid-cols-[1fr_1fr]">
            <div className="rounded-[26px] border border-line bg-card p-6">
              <div className="text-[11px] font-bold uppercase tracking-[.18em] text-mute">지금 전화로 받는 매장이 매달 내는 값</div>
              <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-[1.7] text-ink">
                <li>· 전화 20통 × 8분 = <b>하루 2시간 40분</b>, 한 달이면 80시간</li>
                <li>· 영업시간 밖에 온 예약의 <b>40%</b>는 다음 날로 밀리거나 사라져요</li>
                <li>· 수첩·계산기 정산 실수, 단톡방에 다시 물어보는 시간</li>
                <li>· 손님 폰엔 우리 매장 아이콘이 없어요. 생각날 때만 와요</li>
              </ul>
              <div className="mt-3 text-[12px] font-bold text-bad">이건 공짜가 아니에요. 매달 이미 내고 있는 값이에요.</div>
            </div>
            <div className="rounded-[26px] bg-ink p-6 text-on-ink">
              <div className="text-[11px] font-bold uppercase tracking-[.18em] text-gold-lt">안 해 볼 이유를 찾아봤어요</div>
              <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-[1.7]">
                <li>· 초기 투자? <b>0원</b></li>
                <li>· 세팅 비용? <b>0원</b>, 30분이면 직접 끝나요</li>
                <li>· 첫 달? <b>무료</b></li>
                <li>· 안 맞으면? 무약정은 <b>위약금 0원</b>, 약정은 받은 할인만 반환</li>
                <li>· 손님 정보 유출 걱정? <b>실명·번호를 아예 안 받아요</b></li>
              </ul>
              <div className="mt-4 rounded-xl bg-on-ink/10 p-3 text-[13px] font-bold text-gold-lt">잃을 게 없는데 안 해 보면, 그게 손해예요.</div>
            </div>
          </div>

          <div className="mt-12 rounded-[26px] bg-blush-lt/50 p-6 text-center md:p-8">
            <div className="font-serif text-[20px] font-bold md:text-[24px]">앱은 원래 큰 회사만 가졌어요</div>
            <p className="mx-auto mt-2 max-w-xl text-[13px] leading-[1.9] text-mute">개발비 수천만 원, 유지비 매달 수십만 원. 그래서 동네 매장은 전화와 카톡으로 버텼어요. 이제 초기 투자 없이 우리 매장 앱을 갖고, 손님 폰에 우리 로고를 깔아요. 6,000만원이 10만원이 된 게 아니라, 못 가지던 걸 갖게 된 거예요. 옆 가게가 먼저 깔면 손님 폰에는 옆 가게 아이콘이 있어요.</p>
            <Link href="/signup" className="cta-grad mt-5 inline-block rounded-2xl px-7 py-3.5 text-[14px] font-bold text-white shadow-cta">우리 매장 앱 신청하기</Link>
          </div>
        </div>
      </section>

      {/* 재방문 */}
      <section id="revisit" className="scroll-mt-16 border-b border-line/60 bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Retention</div>
          <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">재방문이 곧 매출이에요</h2>
          <p className="mt-3 max-w-2xl text-[13px] leading-[1.9] text-mute">
            새 손님을 데려오는 데는 돈이 들고, 다시 오는 손님은 돈이 안 들어요. 매장 매출은 결국 '한 번 온 손님이 몇 번 더 오느냐' 로 정해져요.
            캐치걸은 예약 앱이 아니라 <b className="text-ink">다시 오게 만드는 장치</b>를 손님 폰에 심는 앱이에요.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {RETENTION_STATS.map((s) => (
              <div key={s.n} className="rounded-[22px] bg-card p-5 shadow-card">
                <div className="font-serif text-[30px] font-bold text-brand">{s.n}</div>
                <div className="mt-1 text-[13px] font-bold">{s.t}</div>
                <p className="mt-2 text-[11px] leading-[1.8] text-mute">{s.d}</p>
                <div className="mt-3 text-[9px] text-mute/80">{s.src}</div>
              </div>
            ))}
          </div>

          <h3 className="mt-12 font-serif text-[22px] font-bold">다시 오게 만드는 장치 여섯 개</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {RETENTION_HOOKS.map(([t, d], i) => (
              <div key={t} className="rounded-[22px] border border-line bg-card p-5">
                <div className="font-mono text-[11px] font-bold text-brand">0{i + 1}</div>
                <div className="mt-1.5 text-[14px] font-bold">{t}</div>
                <p className="mt-1.5 text-[12px] leading-[1.8] text-mute">{d}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-12 font-serif text-[22px] font-bold">재방문율이 오르면 매출은 이렇게 돼요</h3>
          <p className="mt-2 max-w-2xl text-[13px] leading-[1.9] text-mute">슬라이더를 우리 매장 숫자로 맞춰 보세요. 새 손님은 그대로인데 재방문율만 올라도 방문 건수가 이만큼 늘어요.</p>
          <div className="mt-5"><RevisitCalculator /></div>

          <div className="mt-8 grid items-center gap-6 rounded-[26px] bg-card p-6 shadow-card md:grid-cols-[1fr_1.2fr]">
            <div>
              <div className="text-[14px] font-bold">숫자는 매달 관리자 화면에 떠요</div>
              <p className="mt-2 text-[12px] leading-[1.8] text-mute">
                재방문율, 재방문 손님 수, 캐치걸별 재방문율, 오래 안 온 손님. 앱을 깔고 나서 진짜 늘었는지 매장이 직접 확인해요. 늘지 않으면 이유가 보이고, 늘면 어디서 늘었는지 보여요.
              </p>
            </div>
            <Desktop src="/landing/a-revenue.png" alt="매출·재방문 분석 화면" />
          </div>
        </div>
      </section>

      {/* 손님은 찍으면 끝 */}
      <section id="onboard" className="scroll-mt-16 border-b border-line/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Customer onboarding</div>
          <h2 className="mt-2 font-serif text-[28px] font-bold leading-[1.25] md:text-[36px]">
            손님은 <span className="text-brand">QR 찍으면 끝</span>이에요
          </h2>
          <p className="mt-4 max-w-2xl text-[14px] leading-[1.9] text-mute">
            앱스토어에서 받는 앱이 아니에요. 찍으면 그냥 열려요. 설치도, 전화번호도, 회원가입도 없어요.
            <b className="text-ink"> 손님이 귀찮으면 끝이라서, 귀찮을 게 없게 만들었어요.</b>
          </p>

          {/* 세 단계 — 크게 */}
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              ["1", "찍고", "명함이나 포스터의 QR을 폰 카메라로. 앱스토어 안 가요."],
              ["2", "코드 넣고", "직원이 준 네 글자. 닉네임이랑 PIN만 정해요. 실명·번호 없음."],
              ["3", "끝", "30초. 쿠폰이 바로 들어와요. 홈 화면 추가는 하고 싶으면."],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-[26px] bg-card p-6 shadow-card">
                <div className="font-serif text-[48px] font-bold leading-none text-brand">{n}</div>
                <div className="mt-2 font-serif text-[24px] font-bold">{t}</div>
                <p className="mt-2 text-[13px] leading-[1.8] text-mute">{d}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[22px] bg-ink px-6 py-5 text-[14px] leading-[1.8] text-on-ink">
            <b className="text-gold-lt">지갑에 명함 하나.</b> 깔았든 안 깔았든 상관없어요. 다음에 생각나면 지갑에서 꺼내 QR만 찍으면 바로 우리 매장이에요. 홈 화면에 추가해 두면 아이콘 한 번이고요.
          </div>

          {/* 카드 · 포스터 */}
          <div className="mt-12 grid gap-10 md:grid-cols-2">
            <div>
              <h3 className="font-serif text-[22px] font-bold">직원이 건네는 명함</h3>
              <p className="mt-2 text-[13px] leading-[1.8] text-mute">코드 칸에 네임펜으로 네 글자 적어서 방문한 손님에게. 관리자 화면에서 A4 한 장에 열 장씩 뽑아요.</p>
              <div className="mt-5 flex flex-col items-center gap-2">
                <InviteCard storeName="우리 매장" amount={30000} qr={cardQr} url={DEMO.url} code="A3K9" width="min(100%, 440px)" />
                <div className="text-[11px] text-mute">실제 인쇄되는 카드예요 · 명함 크기</div>
              </div>
            </div>
            <div>
              <h3 className="font-serif text-[22px] font-bold">테이블·카운터에 붙이는 포스터</h3>
              <p className="mt-2 text-[13px] leading-[1.8] text-mute">한 줄이에요. 찍으면 끝. 쿠폰 금액이 크게 박혀요. 같은 화면에서 A4로 뽑아요.</p>
              <div className="mt-5 flex flex-col items-center gap-2">
                <InstallPoster storeName="우리 매장" amount={30000} qr={cardQr} width="min(100%, 340px)" />
                <div className="text-[11px] text-mute">실제 인쇄되는 포스터예요 · A4</div>
              </div>
            </div>
          </div>

          {/* 매장 쪽은 이것만 */}
          <div className="mt-12 rounded-[26px] border border-line bg-card p-6">
            <div className="text-[14px] font-bold">매장이 할 일은 세 가지뿐이에요</div>
            <ol className="mt-3 grid gap-3 text-[13px] leading-[1.8] text-mute md:grid-cols-3">
              <li><b className="text-ink">① 손님 닉네임 붙여 넣기</b> — 연결코드가 손님마다 나와요. 안 깔아도 그 손님 기록은 이미 관리자 화면에 있어요.</li>
              <li><b className="text-ink">② 명함에 코드 적어 건네기</b> — 코드는 텔레그램으로 직원에게. 아는 손님, 방문한 손님에게만.</li>
              <li><b className="text-ink">③ 끝</b> — 카드를 잃어버리면 코드만 다시 말해 주면 돼요. 환영 쿠폰 금액은 할인 관리에서 정해요.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* 전과 후 */}
      <section id="before-after" className="scroll-mt-16 border-b border-line/60 bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Before · After</div>
        <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">관리자가 하던 일이 이렇게 바뀌어요</h2>
        <p className="mt-3 max-w-2xl text-[13px] leading-[1.9] text-mute">예약 앱 하나 더 까는 게 아니에요. 전화·수첩·단톡방·계산기·엑셀로 나뉘어 있던 일이 한 화면으로 들어와요.</p>
        <div className="mt-8 overflow-x-auto rounded-[22px] border border-line bg-card shadow-card">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-line bg-well text-[11px] font-bold text-mute">
                <th className="px-4 py-3">하루의 일</th>
                <th className="px-4 py-3">전화·수첩으로</th>
                <th className="px-4 py-3 text-brand">캐치걸로</th>
              </tr>
            </thead>
            <tbody>
              {BEFORE_AFTER.map(([k, b, a]) => (
                <tr key={k} className="border-b border-line/60 align-top last:border-0">
                  <td className="px-4 py-3 font-bold text-ink">{k}</td>
                  <td className="px-4 py-3 leading-[1.7] text-mute">{b}</td>
                  <td className="px-4 py-3 leading-[1.7] text-ink">{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-[1fr_1fr]">
          <div>
            <h3 className="font-serif text-[22px] font-bold">관리자의 하루, 앱이 있으면</h3>
            <ol className="mt-5 flex flex-col gap-4 border-l-2 border-blush-lt pl-5">
              {DAY.map(([t, h, d]) => (
                <li key={t} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-brand bg-card" />
                  <div className="font-mono text-[11px] font-bold text-brand">{t}</div>
                  <div className="mt-0.5 text-[13px] font-bold">{h}</div>
                  <p className="mt-0.5 text-[12px] leading-[1.8] text-mute">{d}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-[26px] bg-ink p-6 text-on-ink">
            <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold-lt">Checklist</div>
            <h3 className="mt-2 font-serif text-[20px] font-bold">이 중 두 개 이상이면, 지금 필요해요</h3>
            <ul className="mt-4 flex flex-col gap-2.5 text-[13px] leading-[1.7]">
              {CHECKLIST.map((c) => (
                <li key={c} className="flex gap-2.5">
                  <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-on-ink/40 text-[10px]">✓</span>
                  <span className="opacity-90">{c}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-2xl bg-on-ink/10 p-4 text-[12px] leading-[1.8]">
              <b>계산해 보면.</b> 하루 전화 예약 20통 × 8분이면 2시간 40분이에요. 앱은 알림 확인 몇 분이면 끝나요. 그 시간이 매일 자리로 돌아와요.
              <div className="mt-1 text-[10px] opacity-60">전화 8분·앱 1분은 업계 통계 기준 예시 계산이에요.</div>
            </div>
            <Link href="/signup" className="mt-5 inline-block rounded-xl bg-gold-lt px-5 py-2.5 text-[12px] font-bold text-ink">가입 신청하기</Link>
          </div>
        </div>
        </div>
      </section>

      {/* 기능 */}
      <section id="features" className="scroll-mt-16 mx-auto max-w-6xl px-5 py-16">
        <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Features</div>
        <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">앱 세 개, 매장 하나</h2>
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

      {/* 손님 폰 안의 자리 */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="rounded-[28px] bg-ink p-6 text-on-ink md:p-10">
          <div className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold-lt">Why install</div>
              <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">손님 폰 홈 화면에 우리 매장 아이콘이 생겨요</h2>
              <p className="mt-3 text-[13px] leading-[1.9] opacity-85">
                전화번호를 안 받는 매장이 손님과 연결되는 유일한 통로예요. 브라우저 주소를 찾을 필요 없이 아이콘 한 번이면 오늘 누가 나왔는지, 지금 되는지가 보이고, 다음 예약은 두 번 탭이에요.
                손님이 우리 매장을 '가끔 생각나는 곳'에서 '폰에 깔린 곳'으로 옮기는 거예요.
              </p>
              <ul className="mt-5 grid gap-2.5 text-[12px] leading-[1.7] sm:grid-cols-2">
                {[
                  ["즐겨찾기한 사람이 오늘 나왔는지", "홈에서 바로 보여요. 그날 자리로 이어져요."],
                  ["등급 혜택이 자동으로", "5번째, 10번째 방문에 혜택이 붙고 손님이 직접 적용해요."],
                  ["쿠폰이 앱으로 가요", "문자 없이도 쿠폰과 요일 프로모션이 손님 화면에 떠요."],
                  ["후기와 추천이 남아요", "다음 손님이 고를 때 보는 게 쌓여요. 매장이 답글도 달아요."],
                ].map(([t, d]) => (
                  <li key={t} className="rounded-2xl bg-on-ink/10 p-3.5">
                    <div className="font-bold">{t}</div>
                    <div className="mt-0.5 opacity-75">{d}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <Phone src="/landing/c-me.png" alt="손님의 내 화면 — 등급과 방문 기록" />
            </div>
          </div>
        </div>
      </section>

      {/* 손님 정보 */}
      <section id="privacy" className="scroll-mt-16 border-y border-line/60 bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Privacy by design</div>
            <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">고객 DB를 만들지 않아요</h2>
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
      <section id="legal" className="scroll-mt-16 mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-[28px] border border-gold/40 bg-card p-6 shadow-card md:p-10">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Compliance</div>
          <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">합법 매장만, 확인하고 엽니다</h2>
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

      {/* 지원 */}
      <section id="support" className="scroll-mt-16 border-y border-line/60 bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Support</div>
        <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">앱만 주고 끝나지 않아요</h2>
        <p className="mt-3 max-w-2xl text-[13px] leading-[1.9] text-mute">매장이 컴퓨터를 잘 몰라도 돼요. 세팅부터 첫 주까지 붙어서 하고, 그 뒤로도 같은 텔레그램으로 이어져요.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SUPPORT.map(([t, d], i) => (
            <div key={t} className="rounded-[22px] border border-line bg-card p-5">
              <div className="font-mono text-[11px] font-bold text-brand">0{i + 1}</div>
              <div className="mt-1.5 text-[14px] font-bold">{t}</div>
              <p className="mt-1.5 text-[12px] leading-[1.8] text-mute">{d}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* 가격 */}
      <section id="pricing" className="scroll-mt-16">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Pricing</div>
          <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">구축비 없이, 첫 달 무료로 시작해요</h2>
          <p className="mt-3 max-w-2xl text-[13px] leading-[1.9] text-mute">월 13만원인데 {TERM_MONTHS / 12}년 쓰신다고 하면 10만원에 해드리고, 방문 세팅 30만원도 빼드려요. 무약정도 진짜로 있어요. 한도를 넘겨도 영업 중에 등록이 막히지 않아요.</p>
          <div className="mt-8"><PricingTable /></div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {plans.map((k) => {
              const p = PLANS[k];
              const lim = (n: number | null, unit: string) => (n === null ? "무제한" : `${n.toLocaleString("ko-KR")}${unit}`);
              return (
                <div key={k} className={`rounded-[26px] p-6 shadow-card ${k === "MAX" ? "bg-ink text-on-ink" : "bg-card"}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-[22px] font-bold">{p.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${k === "MAX" ? "bg-on-ink/15 text-gold-lt" : "bg-blush-lt text-brand"}`}>{TERM_MONTHS / 12}년 약정 {termDiscountPercent(k)}% 할인</span>
                  </div>
                  <div className={`mt-2 font-serif text-[32px] font-bold ${k === "MAX" ? "text-gold-lt" : "text-brand"}`}>
                    {won(p.termPrice)}<span className={`text-[12px] font-normal ${k === "MAX" ? "opacity-70" : "text-mute"}`}>/월</span>
                  </div>
                  <div className={`mt-1 text-[11px] ${k === "MAX" ? "opacity-70" : "text-mute"}`}>무약정 {won(p.price)}/월 · 첫 달 무료</div>
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
              <div className="mt-2 font-serif text-[32px] font-bold text-brand">0원</div>
              <div className="mt-1 text-[11px] text-mute">세팅은 관리자 화면에서 직접 · 30분</div>
              <ul className="mt-4 flex flex-col gap-1.5 text-[12px] text-ink">
                <li>룸·조 시간·옵션은 신청서에서 완료</li>
                <li>손님은 닉네임 붙여 넣기로 연결코드 일괄 발급</li>
                <li>큐알 세 장 매장 설정에서 바로 인쇄</li>
                <li>대시보드 할 일 목록이 빠진 걸 알려줘요</li>
                <li className="text-mute">방문 세팅(사진 촬영·명단 정리·교육)은 약정 무료 · 무약정 {won(ONSITE_SETUP_FEE)}</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-mute">결제는 CMS 자동이체예요. 승인 뒤 링크 하나로 출금 동의를 등록하면 매월 {DEBIT_DAY}일 매장 계좌에서 빠져요. 첫 달은 무료고, 승인 뒤 한 달이 지난 첫 출금일부터 고른 금액이에요. 카드번호도 종이 서류도 필요 없어요.</div>
        </div>
      </section>

      {/* 설치·샘플 */}
      <section id="install" className="scroll-mt-16 border-y border-line/60 bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_1fr]">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Install · Demo</div>
            <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">앱스토어 없이, 매장 주소에서 설치</h2>
            <p className="mt-3 text-[13px] leading-[1.9] text-mute">
              매장마다 <b className="text-ink">이름.catchgirl.kr</b> 주소가 생겨요. 손님은 그 주소에서, 직원은 <b className="text-ink">/staff</b>, 관리자는 <b className="text-ink">/admin</b>에서 '앱으로 설치'를 누르면 홈 화면에 매장 로고 아이콘으로 깔려요. 큐알 세 장을 콘솔이 만들어 줘요.
            </p>
            <div className="mt-6 rounded-[22px] border border-line bg-card p-5">
              <div className="text-[13px] font-bold">샘플 매장으로 직접 눌러 보세요</div>
              <p className="mt-1 text-[12px] leading-[1.8] text-mute">10년치 예약·손님·매출이 들어 있는 예시 매장이에요. 손님 앱·관리자·직원 앱 세 개를 계정과 함께 전부 열어 뒀어요. 마음껏 눌러 보세요.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/demo" className="cta-grad rounded-xl px-4 py-2.5 text-[12px] font-bold text-white shadow-cta">샘플 세 앱 열어 보기 ›</Link>
                <a href={`${DEMO.url}/login`} target="_blank" rel="noreferrer" className="rounded-xl border border-line bg-card px-4 py-2.5 text-[12px] font-bold hover:border-brand">손님 앱 바로 열기 ↗</a>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-3">
            <Phone src="/landing/c-home.png" alt="손님 앱" className="w-[180px] mt-8" />
            <Phone src="/landing/s-home.png" alt="직원 앱" className="w-[180px]" />
          </div>
        </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">FAQ</div>
          <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">자주 묻는 질문</h2>
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
        <h2 className="font-serif text-[26px] font-bold md:text-[34px]">한 번 온 손님을 다시 오게, 오늘 밤부터</h2>
        <p className="mx-auto mt-3 max-w-xl text-[13px] leading-[1.9] text-mute">신청서를 내면 사업자 확인 뒤 보통 영업일 하루 안에 열어 드려요. 구축비 없이 첫 달 무료로 시작하고, 첫 주는 붙어서 봐 드려요.</p>
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
            <Link href="/agent/login" className="hover:text-ink">담당직원 로그인 · 가입</Link>
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
        <div className="border-t border-line/60 px-5 py-4 text-center text-[10px] text-mute/70">© 2026 캐치걸 · 매장 전용 전담 매니저 예약·운영 소프트웨어 · 손님의 실명과 전화번호를 받지 않아요</div>
      </footer>
    </div>
  );
}
