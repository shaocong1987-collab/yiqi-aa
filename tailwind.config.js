/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Body sans — friendly modern grotesque
        body: [
          "Onest",
          "\"Noto Sans SC\"",
          "\"PingFang SC\"",
          "\"Hiragino Sans GB\"",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ],
        // Display — distinctive headline grotesque with subtle warmth
        display: [
          "\"Bricolage Grotesque\"",
          "Onest",
          "\"Noto Sans SC\"",
          "\"PingFang SC\"",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ],
        // Italic display serif — used for ¥ glyph and editorial accent
        serif: [
          "\"Instrument Serif\"",
          "\"Noto Serif SC\"",
          "Georgia",
          "serif"
        ],
        // Monospace — used for tiny meta-labels (TOTAL / DATE / etc.)
        mono: [
          "\"DM Mono\"",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace"
        ]
      },
      colors: {
        // paper — warm cream surfaces
        paper: {
          50: "#fdfaf4",   // ivory card surface
          100: "#f3ecdd",  // app background
          200: "#e8e0cc",  // light border
          300: "#d5c8ad",  // stronger border
        },
        ink: "#1a1410",          // deep warm black
        // clay (Citrus accent) — kept named "clay" so existing classes still work
        clay: "#ff5e29",         // tangerine accent
        moss: "#4b5a35",         // sparingly used green
        // Legacy "mint" tokens repurposed as accent scale
        mint: {
          50: "#ffe8db",   // softest accent tint
          100: "#ffd1bc",  // soft accent
          600: "#ff5e29",  // primary accent
          700: "#d94a1f",  // accent hover/pressed
        },
        // hero — near-black warm tone for dark hero cards
        hero: "#1d1814",
        // linen retained for legacy class usage
        linen: "#fdfaf4",
        // Category pastel set
        cat: {
          meal:    "#ffd5c2",  // 餐饮餐费
          drink:   "#e8d8ee",  // 酒水饮品
          food:    "#ffe9b8",  // 食材采购
          hotel:   "#d4e0c5",  // 住宿费用
          traffic: "#cfdef0",  // 交通出行
          fuel:    "#cfdef0",  // 油费高速
          ticket:  "#cfdef0",  // 车票机票
          exp:     "#fcd6e3",  // 特色体验
          equip:   "#e6e0d4",  // 装备物资
          child:   "#ffe1d5",  // 儿童相关
          med:     "#ffd9d9",  // 医药应急
          service: "#e6e0d4",  // 服务杂费
          other:   "#e6e0d4",  // 其他费用
        },
      },
      boxShadow: {
        // softer, warmer shadows than before
        soft:  "0 1px 2px rgba(26,20,16,0.05), 0 8px 24px rgba(26,20,16,0.06)",
        glass: "0 1px 2px rgba(26,20,16,0.04), 0 18px 40px rgba(26,20,16,0.08)",
        pop:   "0 12px 32px rgba(255,94,41,0.35)",
        pill:  "0 18px 38px rgba(26,20,16,0.32)",
      },
      borderRadius: {
        // bump baseline radius for the Citrus look
        lg: "14px",
        xl: "18px",
        "2xl": "22px",
      },
    }
  },
  plugins: []
};
