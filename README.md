# 🌸 秋霞大C 工作坊統計儀表板

即時視覺化秋霞大C教育組各類工作坊的參與數據，數據自動同步 Google 試算表。

**線上看 → https://qiuxia-workshop.vercel.app**

---

## 功能特色

- 📊 **KPI 總覽** — 總人次、獨立人數、場次、複訓率
- 📈 **月份趨勢圖** — 每月參與人次走勢
- 🥧 **類別分布圖** — 經營/領導/招募等各類工作坊比例
- 🏠 **小C排行** — 各小C參與次數 TOP10
- ⭐ **出席王** — 參加最多次的夥伴 TOP10
- 🏆 **職級分布** / 🎭 **角色分布**
- 🔍 **完整篩選器** — 工作坊類別 / 所屬小C / 職級 / 角色 / 時間範圍
- ♻️ **自動更新** — 每次開啟頁面自動抓取 Google 試算表最新資料

---

## 技術棧

React + Vite + Tailwind CSS + Chart.js

資料來源：Google Sheets（公開 CSV，無需 API Key）

---

## 開發

```bash
npm install
npm run dev      # 本地開發
npm run build    # 建構 production 版本
```

---

## Vercel 部署

已連接 GitHub，每次 push 自動部署。

---

MIT License · 秋霞大C教育組
