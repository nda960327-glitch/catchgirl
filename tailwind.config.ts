import type { Config } from "tailwindcss";

// 모든 색은 CSS 변수를 읽는다. 매장 레이아웃이 테마 한 벌을 변수로 내려주면
// 컴포넌트는 테마를 모른 채 bg-card, text-ink 만 쓰면 된다.
// 채널(r g b)로 두어야 bg-brand/70 같은 투명도 표기가 동작한다.
const v = (name: string) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: v("brand"),
        "brand-dark": "var(--brand-dark)",
        blush: v("blush"),
        "blush-lt": v("blush-lt"),
        gold: v("gold"),
        "gold-lt": "#F2C399",
        ink: v("ink"),
        "on-ink": v("on-ink"),
        mute: v("mute"),
        line: v("line"),
        paper: v("paper"),
        frame: v("frame"),
        card: v("card"),
        well: v("well"),
        "well-2": v("well-2"),
        ok: v("ok"),
        "ok-bg": v("ok-bg"),
        bad: v("bad"),
        "bad-bg": v("bad-bg"),
        day: v("day"),
        "day-bg": v("day-bg"),
        night: v("night"),
        "night-bg": v("night-bg"),
      },
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "Apple SD Gothic Neo", "system-ui", "sans-serif"],
        serif: ["Nanum Myeongjo", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 6px 20px rgba(0,0,0,.08)",
        cta: "0 10px 24px rgb(var(--brand-rgb) / .28)",
        pop: "0 26px 60px rgba(0,0,0,.28)",
      },
      keyframes: {
        fade: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        pop: { from: { opacity: "0", transform: "scale(.82)" }, to: { opacity: "1", transform: "scale(1)" } },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
      },
      animation: {
        fade: "fade .5s both",
        pop: "pop .6s cubic-bezier(.2,.9,.3,1.3) both",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
