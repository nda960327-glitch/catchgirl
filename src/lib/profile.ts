/**
 * 직원 프로필 항목.
 *
 * 앱이 정해 둔 신체·습관 항목(키·몸무게·흡연·문신)은 없다. 직원을 몸으로 비교해 고르는
 * 화면은 만들지 않는다. 매장이 보여주고 싶은 것(외국어, 잘 만드는 칵테일 등)만 매장이
 * 스스로 항목을 만든다 — StoreProfileField. 신체 항목은 profanity.ts 의 bodyCheck 가 막는다.
 * 빈 값은 화면에 아예 내보내지 않는다.
 */

/** 매장이 만든 항목 하나 (설명용 이름 + 이 직원의 값) */
export type CustomFact = { fieldId: string; label: string; value: string };

/** 손님 화면에 줄 세워 보여줄 항목만 골라 만든다 */
export function profileChips(custom: CustomFact[] = []): { label: string; value: string }[] {
  return custom.filter((c) => c.value.trim()).map((c) => ({ label: c.label, value: c.value }));
}

/** 매장 항목 정의 — DB 행을 화면·검색에서 쓰기 좋은 모양으로 */
export type ProfileFieldDef = { id: string; label: string; kind: "CHOICE" | "TEXT"; options: string[]; showInFilter: boolean };

export function parseFieldOptions(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** 검색 조건 키. 매장 항목은 "<fieldId>:<보기>" 꼴로 URL 에 실린다 */
export const customFilterKey = (fieldId: string, option: string) => `${fieldId}:${option}`;
export function parseCustomFilterKey(key: string): { fieldId: string; option: string } | null {
  const i = key.indexOf(":");
  if (i <= 0) return null;
  return { fieldId: key.slice(0, i), option: key.slice(i + 1) };
}
