/**
 * 바(bar) 업종 구분과 영업 허가.
 *
 * 이 앱은 바 전용이다. 손님이 자리를 맡을 전담 바텐더를 미리 고르는 앱이고,
 * 업장이 어떤 바인지와 어떤 허가로 영업하는지를 가입 때 받아 둔다.
 *
 * 법적 기준(식품위생법):
 *  - 유흥주점(1종): 유흥종사자를 두고 손님 옆에 앉아 응대(유흥접객)할 수 있는 유일한 허가.
 *    종업원이 손님 옆에 앉는 '착석바' 는 반드시 1종이어야 한다.
 *  - 단란주점(2종): 술을 팔고 손님이 노래를 부를 수 있지만, 유흥종사자 고용·동석은 안 된다.
 *  - 일반음식점: 술을 팔 수 있지만 유흥종사자 고용·동석은 안 된다.
 *  '토킹바' 는 종업원이 바 안쪽에 서서(standing) 건너편 손님과 대화만 하므로 2종·일반음식점으로도 영업한다.
 */
export type BarType = "SEATED" | "TALKING" | "CLASSIC" | "MODERN" | "COCKTAIL";
export type LicenseType = "ENTERTAINMENT" | "DANRAN" | "RESTAURANT";

export const LICENSES: { key: LicenseType; label: string; short: string; desc: string }[] = [
  { key: "ENTERTAINMENT", label: "유흥주점 (1종)", short: "1종", desc: "유흥종사자를 두고 손님 옆에 앉아 응대할 수 있는 유일한 허가예요. 착석바는 이 허가가 있어야 해요." },
  { key: "DANRAN", label: "단란주점 (2종)", short: "2종", desc: "술을 팔고 손님이 노래할 수 있어요. 종업원이 손님 옆에 앉는 건 안 돼요. 바 안쪽에서 응대하는 토킹바·클래식바가 여기 해당해요." },
  { key: "RESTAURANT", label: "일반음식점", short: "일반음식점", desc: "술을 팔 수 있지만 유흥종사자 고용·동석은 안 돼요. 바 안쪽에서 응대하는 바가 여기 해당해요." },
];

export const BAR_TYPES: { key: BarType; label: string; desc: string; allowed: LicenseType[]; law: string }[] = [
  { key: "SEATED", label: "착석바", desc: "바텐더가 손님 옆자리에 앉아 응대해요", allowed: ["ENTERTAINMENT"], law: "손님 옆에 앉는 응대(유흥접객)는 유흥주점(1종) 허가에서만 합법이에요. 1종 허가증이 있어야 등록돼요." },
  { key: "TALKING", label: "토킹바", desc: "바텐더가 바 안쪽에 서서 건너편 손님과 대화해요", allowed: ["ENTERTAINMENT", "DANRAN", "RESTAURANT"], law: "손님 옆에 앉지 않고 바 안쪽에서 응대하므로 일반음식점·2종으로도 영업할 수 있어요. 동석은 안 돼요." },
  { key: "CLASSIC", label: "클래식바", desc: "위스키·정통 칵테일 중심, 바 카운터 응대", allowed: ["ENTERTAINMENT", "DANRAN", "RESTAURANT"], law: "바 안쪽에서 응대하는 일반 바예요. 일반음식점·2종·1종 모두 가능해요." },
  { key: "MODERN", label: "모던바", desc: "캐주얼한 분위기의 바, 바 카운터 응대", allowed: ["ENTERTAINMENT", "DANRAN", "RESTAURANT"], law: "바 안쪽에서 응대하는 일반 바예요. 일반음식점·2종·1종 모두 가능해요." },
  { key: "COCKTAIL", label: "칵테일바", desc: "칵테일 전문, 바텐더 지명 응대", allowed: ["ENTERTAINMENT", "DANRAN", "RESTAURANT"], law: "바 안쪽에서 응대하는 일반 바예요. 일반음식점·2종·1종 모두 가능해요." },
];

export const barTypeOf = (v: string): BarType | null => (BAR_TYPES.some((b) => b.key === v) ? (v as BarType) : null);
export const licenseOf = (v: string): LicenseType | null => (LICENSES.some((l) => l.key === v) ? (v as LicenseType) : null);
export const barLabel = (v: string) => BAR_TYPES.find((b) => b.key === v)?.label ?? "";
export const licenseLabel = (v: string) => LICENSES.find((l) => l.key === v)?.label ?? "";

/** 이 바 유형이 이 허가로 합법인지. 착석바는 1종만. */
export function barLicenseOk(barType: string, license: string) {
  const b = BAR_TYPES.find((x) => x.key === barType);
  const l = licenseOf(license);
  if (!b || !l) return false;
  return b.allowed.includes(l);
}

export function barLicenseProblem(barType: string, license: string): string | null {
  const b = BAR_TYPES.find((x) => x.key === barType);
  if (!b) return "업장 유형을 골라 주세요.";
  if (!licenseOf(license)) return "영업 허가 종류를 골라 주세요.";
  if (!barLicenseOk(barType, license)) return `${b.label}은(는) ${b.allowed.map(licenseLabel).join("·")} 허가가 있어야 등록할 수 있어요. ${b.law}`;
  return null;
}
