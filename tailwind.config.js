// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0A0F1E",
        surface: "#0F172A",
        surface2: "#111827",
        outline: "#1F2937",
        primary: "#60A5FA",
        secondary: "#34D399",
        tertiary: "#FBBF24",
        danger: "#EF4444",
        slateInk: "#E5E7EB",
      },
      borderRadius: { xl: "16px" },
      boxShadow: { card: "0 6px 12px rgba(0,0,0,0.25)" },
    },
  },
  plugins: [],
};
