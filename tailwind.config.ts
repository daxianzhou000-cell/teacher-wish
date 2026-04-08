import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        line: "#d7deea",
        paper: "#f6f3ec",
        panel: "#fffdf9",
        accent: "#2762d3",
        accentSoft: "#e7efff",
        success: "#2f6f4f",
      },
      boxShadow: {
        sheet: "0 18px 48px rgba(23, 32, 51, 0.08)",
      },
      fontFamily: {
        sans: [
          "\"Source Han Sans SC\"",
          "\"Noto Sans SC\"",
          "\"PingFang SC\"",
          "\"Helvetica Neue\"",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
