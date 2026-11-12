import type { Config } from "tailwindcss";

// Palette and shape scale follow a fintech design reference (lime accent, near-black ink,
// sage surfaces, large rounded cards).
export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
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
      },
    },
  },
  plugins: [],
} satisfies Config;
