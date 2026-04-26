# 🌸 秋霞大C 工作坊統計儀表板

即時視覺化秋霞大C教育組各類工作坊的參與數據，數據自動同步 Google 試算表。

**線上看 → https://qiuxia-workshop.vercel.app**

---

## 功能特色

- 🥧 **玫瑰圖** — 小C參與人數（Nightingale Rose Chart）
- 📊 **漸層柱狀圖** — 各小C參與排行
- 📊 **漸層條形圖** — 水平排名視圖
- 🔍 **三層連動篩選** — 年份 → 日期 → 工作坊類別
- ⬇️ **下載 PNG** — 每個圖表可獨立下載 2x 解析度圖片
- 📋 **參與者名單** — 按小C分組顯示
- ♻️ **自動更新** — 每次開啟頁面自動抓取 Google 試算表最新資料

---

## 技術棧

- 純 HTML + ECharts 5（無需 npm / build）
- Vercel Serverless Function（`/api/data`）
- 資料來源：Google Sheets（公開 CSV，無需 API Key）

---

## 本地開發（雙擊就能開）

```bash
# 直接用瀏覽器打開 index.html 即可
open index.html
```

> 注意：雙擊開啟時會因為 CORS 限制無法抓 Google Sheets，請改用下面任一方式

```bash
# 方式1：用 http-server 繞過 CORS
npx http-server . -p 8080
# 然後打開 http://localhost:8080

# 方式2：用 Vercel CLI
npx vercel dev
```

---

## Vercel 部署

已連接 GitHub，`main` 分支 push 後自動部署。

```
vercel deploy        # 預覽
vercel --prod        # 正式上線
```

---

## 專案結構

```
/
├── index.html        # 主頁（純 HTML + ECharts）
├── api/
│   └── data.js       # Vercel Serverless Function
├── vercel.json       # Vercel 設定
├── vercel.json       # Vercel 設定
├── index_react_backup.html  # 舊版 React 備份（可刪除）
└── README.md
```

---

MIT License · 秋霞大C教育組
