/**
 * 요금제.
 *
 * 한도는 DB 가 아니라 여기서 관리한다. 매장마다 다른 값을 주기 시작하면
 * 어느 매장이 무슨 조건인지 아무도 모르게 되고, 청구서와 화면이 어긋난다.
 *
 * 값을 두 개 둔다 — 무약정 월납 정가와 2년 약정가. 실제로 받는 돈은 약정가지만,
 * 무약정이 진짜로 존재해야 "강요" 가 아니고, 약정한 매장은 "싸게 샀다" 가 된다.
 * 중도 해지 때는 남은 기간을 다 물리지 않고 그동안 받은 할인만 돌려받는다 —
 * 그래야 사장도 납득하고, 과도한 위약금으로 깎일 여지도 없다.
 */

export type Plan = "PRO" | "MAX";
export type Commitment = "TERM24" | "MONTHLY";

/** 약정 기간 (개월) */
export const TERM_MONTHS = 24;

/** 할인 표시는 안 쓴다 (정가·약정가 두 값으로 말한다). 행사 때만 0 보다 크게. */
export const DISCOUNT_RATE = 0;
export const DISCOUNT_LABEL = "";

/** CMS 자동이체 출금일 — 매장마다 다르게 두면 관리가 안 된다. 하나로 통일. */
export const DEBIT_DAY = 5;

/** 첫 달은 무료 — 승인 뒤 한 달이 지난 첫 출금일부터 돈다 */
export const FREE_FIRST_MONTH = true;

/** 초기 구축비는 없다. 방문 세팅(사진 촬영·명단 정리·교육)은 무약정이면 1회, 약정이면 무료. */
export const SETUP_FEE = 0;
export const ONSITE_SETUP_FEE = 300_000;

/**
 * 담당직원 커미션 — 2년 약정 매장만. 매장 세팅(사진·명단·직원 안내)까지 담당직원이 해 주는 조건이라
 * 세팅 몫이 안에 들어 있다. 첫 출금 성공한 달에 확정.
 */
export const COMMISSION = { PRO: 500_000, MAX: 1_000_000, ONSITE: 0 } as const;

/** 무제한은 null 로 둔다 — 0 이나 -1 보다 화면에서 다루기 쉽다. */
export type Limits = { customers: number | null; staff: number | null; rooms: number | null };

export const PLANS: Record<Plan, {
  name: string;
  price: number;              // 무약정 월납 정가 (원)
  termPrice: number;          // 2년 약정가 (원)
  limits: Limits;
  dataExport: boolean;
  prioritySupport: boolean;
  tagline: string;
}> = {
  PRO: {
    name: "Pro",
    price: 130_000,
    termPrice: 100_000,
    limits: { customers: 1_000, staff: 10, rooms: 5 },
    dataExport: false,
    prioritySupport: false,
    tagline: "한 자리에서 자리를 지키는 매장을 위한 요금제",
  },
  MAX: {
    name: "Max",
    price: 390_000,
    termPrice: 300_000,
    limits: { customers: null, staff: null, rooms: null },
    dataExport: true,
    prioritySupport: true,
    tagline: "캐치걸도 룸도 늘려 가는 매장을 위한 요금제",
  },
};

export const planOf = (v: string): Plan => (v === "MAX" ? "MAX" : "PRO");
export const commitmentOf = (v: string): Commitment => (v === "MONTHLY" ? "MONTHLY" : "TERM24");
export const COMMITMENT_LABEL: Record<Commitment, string> = { TERM24: `${TERM_MONTHS / 12}년 약정`, MONTHLY: "무약정 (월납)" };

/** 실제 청구 금액 — 약정이면 약정가, 아니면 정가 */
export const billedPrice = (plan: Plan, commitment: Commitment = "TERM24") =>
  commitment === "TERM24" ? PLANS[plan].termPrice : PLANS[plan].price;

/** 약정으로 매달 깎이는 금액 (정가 − 약정가) — 중도 해지 때 이만큼씩 돌려받는다 */
export const termDiscountPerMonth = (plan: Plan) => PLANS[plan].price - PLANS[plan].termPrice;

/** 약정 할인율 표시용 — 23% */
export const termDiscountPercent = (plan: Plan) => Math.round((termDiscountPerMonth(plan) / PLANS[plan].price) * 100);

/** 방문 세팅 비용 — 약정이면 무료 */
export const onsiteSetupFee = (commitment: Commitment) => (commitment === "TERM24" ? 0 : ONSITE_SETUP_FEE);

/**
 * 약정 중도 해지 때 돌려받는 금액.
 * 남은 기간 전액이 아니라 그동안 받은 할인(월 할인액 × 청구된 달 수)과 무료로 해 준 방문 세팅비.
 */
export function earlyTerminationFee(store: { plan: string; commitment: string; onsiteSetupDone: boolean }, billedMonths: number) {
  if (commitmentOf(store.commitment) !== "TERM24") return { discountRefund: 0, setupRefund: 0, total: 0 };
  const discountRefund = termDiscountPerMonth(planOf(store.plan)) * Math.max(0, billedMonths);
  const setupRefund = store.onsiteSetupDone ? ONSITE_SETUP_FEE : 0;
  return { discountRefund, setupRefund, total: discountRefund + setupRefund };
}

/** 한도 대비 사용량. limit 이 null 이면 무제한이라 넘칠 일이 없다. */
export function usageOf(used: number, limit: number | null) {
  if (limit === null) return { used, limit, ratio: 0, over: false, remaining: null as number | null };
  return { used, limit, ratio: Math.min(1, used / limit), over: used > limit, remaining: Math.max(0, limit - used) };
}

/**
 * 요금제 안내 문구.
 *
 * 한도를 넘겨도 등록을 막지 않는다는 점이 핵심이다. 손님 앞에서 등록이 막히는
 * 순간은 하필 영업 중이고, 그날로 앱을 안 쓰게 된다.
 */
export const POLICY: { title: string; body: string }[] = [
  {
    title: "청구와 결제",
    body:
      "요금은 CMS 자동이체로 매월 5일에 매장 계좌에서 출금돼요. 승인되면 운영사가 보내는 출금 동의 링크로 계좌를 등록해요. 종이 서류나 카드번호는 필요 없어요.\n" +
      "첫 달은 무료예요. 승인 뒤 한 달이 지난 첫 5일부터 고른 요금제 금액이 매달 선불로 출금돼요. 잔액 부족으로 못 빠지면 며칠 뒤 다시 시도하고, 그래도 안 되면 관리자 화면에 안내가 떠요.\n" +
      "중간에 요금제를 올리시면 남은 기간만큼만 차액으로 계산해 드려요. 내리시는 경우에는 다음 출금일부터 적용돼요.",
  },
  {
    title: "약정과 무약정",
    body:
      "무약정은 Pro 130,000원, Max 390,000원을 매달 내고 언제든 해지할 수 있어요. 위약금이 없어요.\n" +
      "2년 약정은 Pro 100,000원, Max 300,000원이고(23% 할인), 방문 세팅 300,000원도 무료예요. 24개월이 지나면 자동으로 무약정으로 이어지고, 약정을 다시 하면 같은 가격이에요.\n" +
      "약정을 중간에 해지하면 남은 기간을 다 물리지 않아요. 그동안 매달 받은 할인액(Pro 30,000원, Max 90,000원 × 청구된 달 수)과, 무료로 해 드린 방문 세팅비 300,000원만 돌려주시면 돼요. 관리자 화면 '요금제' 에 지금 해지하면 얼마인지 늘 적혀 있어요.",
  },
  {
    title: "한도를 넘었을 때",
    body:
      "한도를 넘겨도 고객 등록이나 예약이 막히지 않아요. 영업 중에 손님을 앞에 두고 등록이 안 되는 일은 없어야 하니까요.\n" +
      "대신 관리자 화면에 안내가 뜨고, 넘긴 상태가 이어지면 다음 출금일에 맞는 요금제로 올려 드려요. 올리기 전에 미리 알려드리고, 원하지 않으시면 그 전에 정리하실 수 있어요.\n" +
      "캐치걸이 잠깐 늘었다 줄어드는 정도로는 요금제가 바뀌지 않아요. 출금일 기준으로 한 번만 봐요.",
  },
  {
    title: "고객 수는 어떻게 세나요",
    body:
      "연결코드를 받아 등록된 계정 수예요. 아직 앱을 시작하지 않은 분도 등록된 것으로 세요.\n" +
      "Max 는 손님 수에 제한이 없어요. 이 기준은 Pro 한도를 볼 때만 써요.\n" +
      "삭제하신 고객은 세지 않아요. 다만 그 손님의 방문·매출 기록도 함께 사라지니 신중히 지워 주세요.\n" +
      "블랙리스트로 표시하신 분은 계정이 남아 있으므로 계속 세요.",
  },
  {
    title: "해지",
    body:
      "무약정은 언제든 해지할 수 있고 위약금이 없어요. 약정은 위 '약정과 무약정' 대로 받은 할인만 돌려주시면 돼요.\n" +
      "해지하시면 손님들의 예약 화면이 먼저 닫히고, 관리자 화면은 90일 동안 열어 둬요. 그동안 매출과 고객 기록을 내려받으실 수 있어요.\n" +
      "90일이 지나면 데이터를 지워요. 다시 시작하실 때 복구해 드릴 수 없으니, 필요하시면 그 전에 말씀해 주세요.",
  },
  {
    title: "우리가 보관하는 것",
    body:
      "손님의 휴대폰 번호와 실명은 처음부터 받지 않아요. 닉네임과 PIN, 그리고 매장이 직접 적어 두신 메모와 연락처만 있어요.\n" +
      "매장이 적어 두신 연락처는 손님 화면에 절대 보이지 않고, 매장 관리자만 볼 수 있어요.\n" +
      "데이터는 매장별로 나뉘어 있어 다른 매장에서 볼 수 없어요.",
  },
  {
    title: "지원",
    body:
      "Pro 는 영업일 기준 하루 안에 답을 드려요. Max 는 영업시간 중 우선으로 처리하고, 급한 일은 전화로 받아요.\n" +
      "예약이 안 되거나 화면이 열리지 않는 문제는 요금제와 관계없이 가장 먼저 처리해요.\n" +
      "쓰시다가 필요한 기능이 생기면 말씀해 주세요. 다른 매장에도 도움이 되는 것은 요금제와 관계없이 만들어 드려요.",
  },
  {
    title: "세팅",
    body:
      "초기 구축비는 없어요. 룸·조 시간·옵션은 가입 신청 때 이미 들어가고, 캐치걸 프로필과 기존 손님은 관리자 화면에서 직접 넣어요. 손님은 닉네임 목록을 붙여 넣으면 연결코드가 한꺼번에 나와서 30분이면 끝나요.\n" +
      "대시보드에 '문 열기 전에 채워 두세요' 목록이 떠서 뭘 안 했는지 바로 보여요. 막히면 텔레그램으로 물어보세요. 첫 주는 붙어서 봐 드려요.\n" +
      "직접 와서 세팅해 드리는 방문 세팅은 사진 촬영, 손님 명단 정리, 직원 교육까지 하루에 끝내요. 2년 약정이면 무료, 무약정이면 1회 300,000원이에요.",
  },
];
