/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Toss 스타일 컬러 팔레트
        primary: {
          DEFAULT: "#3182F6", // Toss 블루
          50: "#E8F3FF",
          100: "#C9E2FF",
          200: "#A0CFFF",
          300: "#74B9FF",
          400: "#4B9EFF",
          500: "#3182F6", // 기본
          600: "#2272EB",
          700: "#1B64DA",
          800: "#1957C2",
          900: "#194AA6",
        },
        neutral: {
          DEFAULT: "#8B95A1",
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#8B95A1", // 기본
          600: "#64748B",
          700: "#475569",
          800: "#27303F",
          900: "#0F172A",
        },
        background: "#FFFFFF",
        foreground: "#27303F",
        border: "#CBD5E1",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
      },
      fontFamily: {
        sans: ["Pretendard", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
