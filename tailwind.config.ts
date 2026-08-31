import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "var(--brand)",
        "brand-dark": "var(--brand-dark)",
        blush: "var(--blush)",
        "blush-lt": "var(--blush-lt)",
        gold: "#C8A46A",
        "gold-lt": "#F2C399",
        ink: "#3A2830",
        mute: "#9A868D",
        line: "#F0E4E5",
        paper: "#FCF7F6",
        frame: "#F3E9EA",
      },
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "Apple SD Gothic Neo", "system-ui", "sans-serif"],
        serif: ["Nanum Myeongjo", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 6px 20px rgba(58,40,48,.06)",
        cta: "0 10px 24px rgba(180,88,106,.28)",
        pop: "0 26px 60px rgba(90,50,62,.22)",
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
