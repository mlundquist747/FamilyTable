import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Skylight-inspired calm palette
        cream: "#FBF8F3",
        ink: "#1F2421",
        sage: {
          50: "#F2F6F2",
          100: "#E2ECE3",
          200: "#C4D8C6",
          300: "#9DBFA1",
          400: "#73A079",
          500: "#4F8257",
          600: "#3D6644",
          700: "#325237",
          800: "#2A422E",
          900: "#233527",
        },
        clay: {
          100: "#FBEAE3",
          300: "#F0B69E",
          500: "#E07856",
          600: "#C85F3E",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
