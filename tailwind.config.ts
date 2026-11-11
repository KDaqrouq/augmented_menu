import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf5ef",
          100: "#fae6d6",
          200: "#f4c9a9",
          300: "#eca473",
          400: "#e37d45",
          500: "#d9622a",
          600: "#bf4c1f",
          700: "#9c3b1c",
          800: "#7e321d",
          900: "#672b1b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(28 25 23 / 0.04), 0 1px 3px rgb(28 25 23 / 0.06)",
        lift: "0 10px 30px -12px rgb(28 25 23 / 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
