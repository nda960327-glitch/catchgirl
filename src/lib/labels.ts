/**
 * 직원 호칭.
 *
 * 매장마다 직원을 부르는 말이 다르다 — 캐치걸, 매니저, 바텐더. 화면 문구는 전부
 * 이 값을 읽고, 조사(을/를, 이/가)는 받침에 맞춰 붙인다. 그래야 "매니저를", "캐치걸을" 이 된다.
 */
export const DEFAULT_STAFF_LABEL = "캐치걸";

export function staffLabelOf(store: { staffLabel?: string | null }) {
  const v = (store.staffLabel ?? "").trim();
  return v || DEFAULT_STAFF_LABEL;
}

/** 마지막 글자에 받침이 있는지 (한글이 아니면 없는 것으로 본다) */
function hasBatchim(word: string) {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 조사 붙이기 — josa("매니저", "을") → "매니저를", josa("캐치걸", "을") → "캐치걸을" */
export function josa(word: string, kind: "을" | "이" | "은" | "과" | "으로") {
  const b = hasBatchim(word);
  const pair: Record<string, [string, string]> = { 을: ["을", "를"], 이: ["이", "가"], 은: ["은", "는"], 과: ["과", "와"], 으로: ["으로", "로"] };
  const [withB, withoutB] = pair[kind];
  // "으로" 는 ㄹ 받침이면 "로"
  if (kind === "으로" && b) {
    const code = word.trim().slice(-1).charCodeAt(0);
    if ((code - 0xac00) % 28 === 8) return word + "로";
  }
  return word + (b ? withB : withoutB);
}
