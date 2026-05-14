# C3 · 暖橘 Citrus 设计落地

本压缩包包含 5 个修改后的文件，**直接覆盖你本地项目同名文件即可**：

```
├── index.html                       (Google Fonts + theme-color)
├── tailwind.config.js               (新调色板 + 字体 token)
├── public/
│   └── manifest.webmanifest         (PWA theme_color)
└── src/
    ├── index.css                    (全局背景 + 输入框样式)
    └── App.tsx                      (UI 原语全部重做：Panel/Button/Stat/HeroVisual/Nav + 分类色芯片)
```

## 应用步骤

1. 解压本 zip
2. 把这 5 个文件**覆盖**到本地：
   - `C:\Users\Administrator\Desktop\自娱自乐的AI\Codex\` 目录下的同名文件
3. 本地预览：
   ```powershell
   cd C:\Users\Administrator\Desktop\自娱自乐的AI\Codex
   $env:Path = "C:\Users\Administrator\Desktop\自娱自乐的AI\Codex\.tools\node-v24.14.0-win-x64;" + $env:Path
   npm run dev -- --port 5173
   ```
   打开 http://127.0.0.1:5173 看一眼，喜欢就继续
4. 验证：
   ```powershell
   npm test
   npm run build
   ```
5. 推送到 GitHub：
   ```powershell
   git add .
   git commit -m "Redesign UI: Citrus direction (warm cream + tangerine + Bricolage Grotesque)"
   git push origin main
   ```
6. 等 GitHub Actions 跑完（~5 分钟），访问 https://shaocong1987-collab.github.io/yiqi-aa/ 就是新版了

## 这次改了什么

**业务逻辑、存储、结算、PWA、Service Worker、组件 props、IndexedDB schema — 全部没动。** 只改了视觉层。

**字体**
- 标题：`Bricolage Grotesque`（取代 Songti SC）— 几何无衬线，有轻微圆润感
- 正文：`Onest`（取代 Avenir Next）— 中性现代
- 强调 ¥：`Instrument Serif` 斜体（新增）
- 小标签：`DM Mono`（新增）
- 中文回退依然是 Noto Sans SC / PingFang SC

**颜色（Tailwind tokens 全部重写，原 class 名保留）**
- `paper-100` 背景：`#f3ecdd` 奶油暖底（取代 `#f5ede0`）
- `paper-50` 卡片：`#fdfaf4` 象牙白
- `ink`：`#1a1410` 深暖黑（取代 `#24211d`）
- `clay`（主色）：`#ff5e29` 焦糖橘（取代 `#bc5739` 陶土）
- 新增 `cat.*` 13 种分类粉彩色
- 新增 `hero` `#1d1814` 用于深色 hero 卡

**组件改动**
- `HeroVisual` → Bento 双格（深色总额卡 + 橘色待结算卡）
- `Panel` / `Stat` / `Button` / `NavButton` / `MobileNavButton` / `Field` / `SummaryBlock` 全部重做
- 新增 `CategoryChip` — 每条费用前面带分类色芯片（餐/宿/行/玩…）
- 底部移动端导航改成黑色浮动药丸
- 桌面端导航更克制（淡色背景 + 橘色高亮）

## 注意

如果发现 GitHub Pages 上字体加载慢，是因为 Google Fonts 国内访问偶尔会慢。所有字体都有系统回退（Onest → Noto Sans SC → PingFang SC），不会出现空白。
