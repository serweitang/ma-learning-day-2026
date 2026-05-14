import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "slide-down": "slideDown 0.2s ease-out both",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        "garena-red": "#E1251B",
        "garena-bg": "#F5F5F5",
        "garena-dark": "#212121",
        "garena-white": "#FFFFFF",
        "highlight-yellow": "#FFF176",
        "highlight-blue": "#B3E5FC",
        jscolors: {
          "garena-red": "#E1251B",
          "garena-bg": "#F5F5F5",
          "garena-dark": "#212121",
          "garena-white": "#FFFFFF",
          "highlight-yellow": "#FFF176",
          "highlight-blue": "#B3E5FC",
        },
      },
    },
  },
  plugins: [],
};
export default config;
