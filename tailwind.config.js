/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mint: {
          50: "#f1fbf6",
          100: "#dcf5e8",
          600: "#3f9675",
          700: "#2f775f"
        },
        linen: "#fbf8ef"
      },
      boxShadow: {
        soft: "0 18px 48px rgba(73, 107, 91, 0.10)"
      }
    }
  },
  plugins: []
};
