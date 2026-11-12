import type { Config } from "tailwindcss";

// Palette and shape scale follow a fintech design reference (lime accent, near-black ink,
// sage surfaces, large rounded cards).
//
// Shape scale, used consistently:
//   cards 24px (rounded-card) > inner panels 16px (rounded-2xl) > controls 12px (rounded-xl)
//   > pills / buttons (rounded-full). Controls are 48px tall (h-12), compact controls 40px.
export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0e0f0c",
        body: "#454745",
        mute: "#6b6d6a",
        lime: { DEFAULT: "#9fe870", pale: "#e2f6d5", deep: "#163300" },
        sage: "#e8ebe6",
        canvas: "#f4f6f2",
        positive: "#054d28",
        negative: "#d03238",
        "negative-pale": "#fbe9ea",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "24px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,15,12,0.04), 0 8px 24px rgba(14,15,12,0.06)",
        pop: "0 12px 32px rgba(14,15,12,0.14)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        pop: {
          from: { opacity: "0", transform: "translateY(-6px) scale(0.97)" },
          to: { opacity: "1", transform: "none" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 160ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shake: "shake 260ms ease-in-out",
        "fade-in": "fade-in 180ms ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
