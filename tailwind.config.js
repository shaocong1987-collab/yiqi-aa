/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        body: [
          "\"Avenir Next\"",
          "\"Gill Sans\"",
          "\"PingFang SC\"",
          "\"Hiragino Sans GB\"",
          "\"Noto Sans SC\"",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ],
        display: [
          "\"Songti SC\"",
          "\"Noto Serif CJK SC\"",
          "\"Source Han Serif SC\"",
          "ui-serif",
          "Georgia",
          "serif"
        ]
      },
      colors: {
        paper: {
          50: "#fbf7ef",
          100: "#f5ede0",
          200: "#eadfce",
          300: "#d8c8b4"
        },
        ink: "#24211d",
        clay: "#bc5739",
        moss: "#66705a",
        mint: {
          50: "#f5e7dc",
          100: "#e9cdbd",
          600: "#bc5739",
          700: "#8f3e29"
        },
        linen: "#fbf7ef"
      },
      boxShadow: {
        soft: "0 18px 48px rgba(46, 39, 31, 0.10)",
        glass: "0 24px 70px rgba(51, 38, 26, 0.14)"
      }
    }
  },
  plugins: []
};
