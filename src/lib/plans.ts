/**
 * 요금제.
 *
 * 한도는 DB 가 아니라 여기서 관리한다. 매장마다 다른 값을 주기 시작하면
 * 어느 매장이 무슨 조건인지 아무도 모르게 되고, 청구서와 화면이 어긋난다.
 */

export type Plan = "PRO" | "MAX";

/** 출시 기념 반값. 끝낼 땐 0 으로 두면 정가로 돌아간다. */
export const DISCOUNT_RATE = 0.5;
export const DISCOUNT_LABEL = "출시 기념 50% 할인";

/** 첫 세팅 비용 — 기존 손님 이관, 캐치걸 프로필 등록, 사용 교육까지 (1회) */
export const SETUP_FEE = 3_000_000;

/** 무제한은 null 로 둔다 — 0 이나 -1 보다 화면에서 다루기 쉽다. */
export type Limits = { customers: number | null; staff: number | null; rooms: number | null };

export const PLANS: Record<Plan, {
  name: string;
  price: number;              // 정가 (월, 원)
  limits: Limits;
  dataExport: boolean;
  prioritySupport: boolean;
  tagline: string;
}> = {
  PRO: {
    name: "Pro",
    price: 190_000,
    limits: { customers: 500, staff: 10, rooms: 5 },
    dataExport: false,
    prioritySupport: false,
    tagline: "한 자리에서 자리를 지키는 매장을 위한 요금제",
  },
  MAX: {
    name: "Max",
    price: 390_000,
    limits: { customers: null, staff: null, rooms: null },
    dataExport: true,
    prioritySupport: true,
    tagline: "캐치걸도 룸도 늘려 가는 매장을 위한 요금제",
  },
};

export const planOf = (v: string): Plan => (v === "MAX" ? "MAX" : "PRO");

/** 할인 적용 후 실제 청구 금액 */
export const billedPrice = (plan: Plan) => Math.round(PLANS[plan].price * (1 - DISCOUNT_RATE));

/** 연납은 두 달치를 빼 준다 */
export const yearlyPrice = (plan: Plan) => billedPrice(plan) * 10;

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
      "요금은 월 단위로 선불 청구돼요. 매달 같은 날에 청구되고, 중간에 요금제를 올리시면 남은 기간만큼만 차액으로 계산해 드려요.\n" +
      "요금제를 내리시는 경우에는 다음 청구일부터 적용돼요. 이미 낸 달의 요금은 돌려드리지 않는 대신, 그달 끝까지는 원래 요금제를 그대로 쓰실 수 있어요.\n" +
      "연납을 선택하시면 열 달치 금액으로 열두 달을 쓰실 수 있어요.",
  },
  {
    title: "한도를 넘었을 때",
    body:
      "한도를 넘겨도 고객 등록이나 예약이 막히지 않아요. 영업 중에 손님을 앞에 두고 등록이 안 되는 일은 없어야 하니까요.\n" +
      "대신 관리자 화면에 안내가 뜨고, 넘긴 상태가 이어지면 다음 청구일에 맞는 요금제로 올려 드려요. 올리기 전에 미리 알려드리고, 원하지 않으시면 그 전에 정리하실 수 있어요.\n" +
      "캐치걸이 잠깐 늘었다 줄어드는 정도로는 요금제가 바뀌지 않아요. 청구일 기준으로 한 번만 봐요.",
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
      "언제든 해지하실 수 있고, 위약금은 없어요. 남은 기간까지는 그대로 쓰실 수 있어요.\n" +
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
    title: "초기 구축",
    body:
      "처음 한 번만 받는 비용이에요. 카톡·전화로 관리하시던 기존 손님을 연결코드와 함께 옮겨 드리고, 캐치걸 프로필과 사진, 룸과 조 시간을 매장에 맞춰 세팅해 드려요.\n" +
      "매장 관리자와 캐치걸 각각 사용 교육을 해 드리고, 문 여는 첫 주 동안은 붙어서 봐 드려요.\n" +
      "이 비용은 요금제와 별개이고, 나중에 요금제를 올리거나 내리셔도 다시 받지 않아요.",
  },
];
