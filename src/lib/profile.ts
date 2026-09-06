/**
 * 캐치걸 프로필의 신체·습관 항목.
 *
 * 손님이 고를 때 실제로 보는 값들이다. 흡연은 자리에서 대화 거리가 가까워
 * 미리 알고 고르고 싶어 하고, 문신은 싫어하는 손님이 있어 밝혀 둔다.
 * 빈 값은 화면에 아예 내보내지 않는다 — 모르는 걸 0 으로 적으면 거짓말이 된다.
 */
export const BUST_SIZES = ["A", "B", "C", "D", "E", "F", "G"] as const;

export type ProfileFacts = {
  heightCm: number | null;
  weightKg: number | null;
  bustSize: string;
  bustNatural: boolean;
  smoker: boolean;
  tattoo: boolean;
  tattooNote: string;
};

/** 손님 화면에 줄 세워 보여줄 항목만 골라 만든다 */
export function profileChips(p: ProfileFacts): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (p.heightCm) out.push({ label: "키", value: `${p.heightCm}cm` });
  if (p.weightKg) out.push({ label: "몸무게", value: `${p.weightKg}kg` });
  if (p.bustSize) out.push({ label: "가슴", value: `${p.bustSize}컵${p.bustNatural ? " · 자연" : ""}` });
  out.push({ label: "흡연", value: p.smoker ? "함" : "안 함" });
  out.push({ label: "문신", value: p.tattoo ? (p.tattooNote || "있음") : "없음" });
  return out;
}
