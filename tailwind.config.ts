import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "Cambria", "serif"],
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui"]
      },
      colors: {
        ink: "#1d1d1f",
        paper: "#fbfaf7",
        muted: "#6f6a63",
        rule: "#ded8cf",
        accent: "#2f6f73"
      }
    }
  },
  plugins: []
};

export default config;
