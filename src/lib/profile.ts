/**
 * 캐치걸 프로필의 신체·습관 항목.
 *
 * 앱이 정해 둔 공통 항목은 키·몸무게·흡연·문신뿐이다. 흡연은 자리에서 대화 거리가
 * 가까워 미리 알고 고르고 싶어 하고, 문신은 싫어하는 손님이 있어 밝혀 둔다.
 * 그 밖에 매장이 더 보여주고 싶은 것(외국어, 성형 여부 등)은 매장이 스스로 항목을
 * 만든다 — StoreProfileField. 빈 값은 화면에 아예 내보내지 않는다.
 */
export type ProfileFacts = {
  heightCm: number | null;
  weightKg: number | null;
  smoker: boolean;
  tattoo: boolean;
  tattooNote: string;
};

/** 매장이 만든 항목 하나 (설명용 이름 + 이 캐치걸의 값) */
export type CustomFact = { fieldId: string; label: string; value: string };

/** 손님 화면에 줄 세워 보여줄 항목만 골라 만든다 */
export function profileChips(p: ProfileFacts, custom: CustomFact[] = []): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (p.heightCm) out.push({ label: "키", value: `${p.heightCm}cm` });
  if (p.weightKg) out.push({ label: "몸무게", value: `${p.weightKg}kg` });
  out.push({ label: "흡연", value: p.smoker ? "함" : "안 함" });
  out.push({ label: "문신", value: p.tattoo ? p.tattooNote || "있음" : "없음" });
  for (const c of custom) if (c.value.trim()) out.push({ label: c.label, value: c.value });
  return out;
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
