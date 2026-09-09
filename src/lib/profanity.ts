/**
 * 금칙어.
 *
 * 손님·직원·매장이 앱 안에 적는 글(닉네임, 요청사항, 후기, 댓글, 소개, 공지, 태그)에
 * 욕설과 성적인 말이 들어오면 저장하지 않는다. 이 앱이 무엇을 위한 앱인지가 화면에
 * 그대로 드러나야 하므로, 걸러내는 쪽이 넓다. 띄어쓰기·특수문자·숫자 치환으로
 * 피해 가는 것도 잡기 위해 비교 전에 글을 한 번 눌러 편다.
 */

const BANNED: string[] = [
  // 욕설 — 일상어와 겹치는 짧은 말(씹, 새끼 단독)은 빼고, 붙여 쓰는 꼴만 잡는다
  "씨발", "시발", "씨팔", "시팔", "쓰발", "씨바", "ㅆㅂ", "ㅅㅂ", "병신", "ㅂㅅ", "빙신", "지랄", "ㅈㄹ", "개새끼", "개새", "개년", "개놈", "미친놈", "미친년",
  "좆", "존나", "ㅈㄴ", "니미", "느금", "엠창", "애미", "애비", "걸레", "창녀", "창놈", "씹년", "씹새", "썅", "새끼야", "새꺄",
  // 성적 표현 — 앱 안에서 쓰는 일상어(조건 검색, 브랜드, 칵테일)와 겹치지 않게 붙여 쓴 꼴로
  "섹스", "쎅스", "sex", "자위", "딸감", "딸치", "야동", "야사", "야짤", "보지", "자지", "성기", "음경", "음부", "유두", "젖꼭지", "젖가슴", "가슴골",
  "질싸", "질내", "뒷치기", "후장", "애널", "항문", "오랄", "펠라", "사까시", "빠구리", "떡치", "떡친", "박아줘", "박히", "삽입", "정액", "노콘",
  "몸캠", "원나잇", "성관계", "성행위", "성매매", "매매춘", "매춘", "조건만남", "조건녀", "스폰", "2차", "출장안마", "출장마사지", "출장서비스", "안마방", "안마시술", "키스방", "립카페", "휴게텔", "오피", "풀싸롱", "풀살롱", "룸싸롱", "룸살롱", "텐프로", "쩜오",
  "가슴만져", "만져줘", "만지게해", "빨아줘", "핥아", "쑤셔", "따먹", "따묵", "덮쳐", "벗겨", "벗어봐", "속옷", "팬티", "노팬", "노브라", "야한", "음란", "변태", "발정",
  "포르노", "porn", "fuck", "bitch", "pussy", "dick", "boobs", "tits", "blowjob", "handjob",
];

/** 비교용으로 눌러 펴기 — 공백·기호 제거, 영문 소문자, 흔한 치환(1→i, 0→o, $→s) */
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[\s\.\,\-\_\*\+\~\!\?\/\\\|\(\)\[\]\{\}<>'"`^%#@&=:;·ㆍ]/g, "")
    .replace(/1/g, "i").replace(/0/g, "o").replace(/\$/g, "s").replace(/3/g, "e");
}

const NORMALIZED = BANNED.map((w) => normalize(w)).filter(Boolean);

/** 걸리는 말이 있으면 그 말을, 없으면 null */
export function findBanned(text: string | null | undefined): string | null {
  if (!text) return null;
  const n = normalize(text);
  if (!n) return null;
  for (let i = 0; i < NORMALIZED.length; i++) {
    if (n.includes(NORMALIZED[i])) return BANNED[i];
  }
  return null;
}

export const BANNED_MESSAGE = "쓸 수 없는 표현이 들어 있어요. 욕설이나 성적인 말은 이 앱에서 쓸 수 없어요.";

/** 여러 칸을 한 번에 — 하나라도 걸리면 { ok: false, error } */
export function cleanCheck(...texts: (string | null | undefined)[]): { ok: true } | { ok: false; error: string } {
  for (const t of texts) if (findBanned(t)) return { ok: false, error: BANNED_MESSAGE };
  return { ok: true };
}
