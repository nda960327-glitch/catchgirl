/**
 * 방문 경로 기본 목록.
 *
 * 매장이 엑셀로 세던 사이트 목록을 그대로 옮겼다. "오피" 라는 말은 화면에 두고
 * 싶지 않아 OP 로 적는다. tier 는 그 사이트에 돈을 내는지(메이저) 아닌지(무료)다 —
 * 광고비를 낸 곳이 실제로 손님을 데려오는지 보려고 나눈다.
 */
export type SourceTier = "FREE" | "MAJOR" | "";

export const TIER_LABEL: Record<SourceTier, string> = { FREE: "무료", MAJOR: "메이저", "": "" };

/**
 * 새 매장의 시작 목록. 어디에 광고를 내는지는 매장마다 달라서 사이트 이름을 미리
 * 넣어 두지 않는다 — 매장이 방문 경로 화면에서 자기 목록을 만든다.
 */
export const DEFAULT_SOURCES: { name: string; tier: SourceTier }[] = [
  { name: "지인 소개", tier: "" },
  { name: "텔레그램 문의", tier: "" },
  { name: "전화 문의", tier: "" },
  { name: "지나가다", tier: "" },
];

/** 이름만으로는 "재방문" 과 구분이 안 되므로 표에서 쓰는 고정 행 이름을 한 곳에 둔다 */
export const REVISIT_LABEL = "재방문";
export const UNKNOWN_LABEL = "미기록";

/**
 * 예약이 들어온 경로. 앱으로만 받는 게 아니라 전화·텔레그램·워크인이 섞인다.
 * 방문 경로(처음 어디서 알고 왔나)와는 다른 값이다 — 단골이 전화로 예약하는 일이 흔하다.
 */
export type Channel = "APP" | "PHONE" | "TELEGRAM" | "WALK_IN";

export const CHANNELS: { key: Channel; label: string }[] = [
  { key: "APP", label: "앱" },
  { key: "PHONE", label: "전화" },
  { key: "TELEGRAM", label: "텔레그램" },
  { key: "WALK_IN", label: "워크인" },
];

export const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(CHANNELS.map((c) => [c.key, c.label]));
