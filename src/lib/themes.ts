/**
 * 매장 테마.
 *
 * 매장마다 분위기가 다르다 — 밝은 분홍이 어울리는 곳이 있고, 조명 낮춘 바처럼
 * 어두운 화면이 어울리는 곳이 있다. 색을 하나하나 고르게 하면 대개 망가지므로
 * 완성된 한 벌을 고르게 하고, 메인 컬러만 따로 바꿀 수 있게 둔다.
 *
 * 모든 색은 CSS 변수로 나가고 Tailwind 토큰이 그걸 읽는다. 그래서 컴포넌트는
 * 테마를 모른 채 bg-card, text-ink 만 쓰면 된다.
 */
import { hexToRgb } from "@/lib/utils";

export type ThemeKey = "rose" | "cream" | "noir" | "wine" | "midnight";

type Palette = {
  name: string;
  desc: string;
  dark: boolean;
  brand: string;
  /** 화면 바탕 */
  paper: string;
  /** 바탕 바깥 (데스크톱에서 폰 프레임 주변) */
  frame: string;
  /** 카드·입력창 */
  card: string;
  /** 카드 안의 옅은 구역 */
  well: string;
  well2: string;
  ink: string;
  mute: string;
  line: string;
  gold: string;
  /** ink 를 배경으로 쓸 때 위에 얹는 글자색 */
  onInk: string;
  ok: string; okBg: string;
  bad: string; badBg: string;
  day: string; dayBg: string;
  night: string; nightBg: string;
};

export const THEMES: Record<ThemeKey, Palette> = {
  rose: {
    name: "로즈", desc: "밝고 부드러운 기본", dark: false,
    brand: "#B4586A",
    paper: "#FCF7F6", frame: "#F3E9EA", card: "#FFFFFF", well: "#FAF6F7", well2: "#F4EDEE",
    ink: "#3A2830", mute: "#9A868D", line: "#F0E4E5", gold: "#C8A46A", onInk: "#FFFFFF",
    ok: "#2E8B57", okBg: "#E8F6EE", bad: "#C0392B", badBg: "#FDECEC",
    day: "#8A6A20", dayBg: "#FFF6E6", night: "#3D4E8C", nightBg: "#EEF1FB",
  },
  cream: {
    name: "크림", desc: "따뜻한 금빛, 밝은 화면", dark: false,
    brand: "#B8862E",
    paper: "#FCF9F2", frame: "#F3ECDD", card: "#FFFFFF", well: "#FAF6EA", well2: "#F3ECDA",
    ink: "#3A3126", mute: "#9B8F7A", line: "#EFE6D3", gold: "#C8A46A", onInk: "#FFFFFF",
    ok: "#2E8B57", okBg: "#E8F6EE", bad: "#C0392B", badBg: "#FDECEC",
    day: "#8A6A20", dayBg: "#FFF3D6", night: "#3D4E8C", nightBg: "#EEF1FB",
  },
  noir: {
    name: "누아르", desc: "검정 바탕에 분홍 포인트", dark: true,
    brand: "#E07A90",
    paper: "#151216", frame: "#0C0A0D", card: "#211C22", well: "#2A2329", well2: "#332A32",
    ink: "#F4EDEF", mute: "#A89AA0", line: "#3A3138", gold: "#D9B77C", onInk: "#151216",
    ok: "#6FCF97", okBg: "#1E3327", bad: "#F07A6A", badBg: "#3B2220",
    day: "#E8C77A", dayBg: "#3A3020", night: "#9FB2F0", nightBg: "#1F2640",
  },
  wine: {
    name: "와인", desc: "짙은 버건디, 조명 낮춘 바", dark: true,
    brand: "#E8899B",
    paper: "#241318", frame: "#160A0E", card: "#301A21", well: "#3A222A", well2: "#452A33",
    ink: "#F7ECEF", mute: "#B99AA3", line: "#4A3039", gold: "#D9B77C", onInk: "#241318",
    ok: "#7BD3A0", okBg: "#213A2C", bad: "#F28B7A", badBg: "#4A2622",
    day: "#E8C77A", dayBg: "#453620", night: "#A9BBF2", nightBg: "#26304C",
  },
  midnight: {
    name: "미드나이트", desc: "남색 바탕, 차분한 밤", dark: true,
    brand: "#7FA4E8",
    paper: "#121826", frame: "#0A0F1A", card: "#1B2334", well: "#222C40", well2: "#2A354B",
    ink: "#EEF2FA", mute: "#98A3BA", line: "#33405A", gold: "#D9B77C", onInk: "#121826",
    ok: "#6FCF97", okBg: "#1B3328", bad: "#F07A6A", badBg: "#3B2220",
    day: "#E8C77A", dayBg: "#3A3420", night: "#A9BBF2", nightBg: "#22304A",
  },
};

export const themeOf = (v: string | null | undefined): ThemeKey => (v && v in THEMES ? (v as ThemeKey) : "rose");

const ch = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
};
const mixTo = (hex: string, t: number, to: number) => {
  const { r, g, b } = hexToRgb(hex);
  const m = (v: number) => Math.round(v + (to - v) * t);
  return `${m(r)} ${m(g)} ${m(b)}`;
};
const hexOf = (rgb: string) => "#" + rgb.split(" ").map((v) => Number(v).toString(16).padStart(2, "0")).join("");

/**
 * 한 벌의 CSS 변수를 만든다. 메인 컬러를 따로 골랐으면 그 색으로 브랜드 계열만
 * 다시 계산한다 — 어두운 테마에서는 브랜드를 흰색 쪽이 아니라 바탕 쪽으로 섞어야
 * 옅은 브랜드색(blush)이 화면에서 튀지 않는다.
 */
export function themeStyle(key: string, brandOverride?: string | null): Record<string, string> {
  const t = THEMES[themeOf(key)];
  const brand = brandOverride && /^#[0-9a-fA-F]{6}$/.test(brandOverride) ? brandOverride : t.brand;
  const towards = t.dark ? 20 : 255; // 어두운 테마는 검정 쪽으로 섞는다
  const { r, g, b } = hexToRgb(brand);
  const brandDark = `#${[r, g, b].map((v) => Math.round(v * 0.85).toString(16).padStart(2, "0")).join("")}`;
  const blush = mixTo(brand, t.dark ? 0.55 : 0.5, towards);
  const blushLt = mixTo(brand, t.dark ? 0.8 : 0.88, towards);

  return {
    "--brand": brand,
    "--brand-dark": brandDark,
    "--blush": hexOf(blush),
    "--blush-lt": hexOf(blushLt),
    "--brand-rgb": ch(brand),
    "--blush-rgb": blush,
    "--blush-lt-rgb": blushLt,
    "--paper-rgb": ch(t.paper),
    "--frame-rgb": ch(t.frame),
    "--card-rgb": ch(t.card),
    "--well-rgb": ch(t.well),
    "--well-2-rgb": ch(t.well2),
    "--ink-rgb": ch(t.ink),
    "--mute-rgb": ch(t.mute),
    "--line-rgb": ch(t.line),
    "--gold-rgb": ch(t.gold),
    "--on-ink-rgb": ch(t.onInk),
    "--ok-rgb": ch(t.ok),
    "--ok-bg-rgb": ch(t.okBg),
    "--bad-rgb": ch(t.bad),
    "--bad-bg-rgb": ch(t.badBg),
    "--day-rgb": ch(t.day),
    "--day-bg-rgb": ch(t.dayBg),
    "--night-rgb": ch(t.night),
    "--night-bg-rgb": ch(t.nightBg),
    // 날짜·시간 입력 같은 브라우저 기본 컨트롤도 테마를 따르게
    colorScheme: t.dark ? "dark" : "light",
  };
}

export const isDarkTheme = (key: string | null | undefined) => THEMES[themeOf(key)].dark;
