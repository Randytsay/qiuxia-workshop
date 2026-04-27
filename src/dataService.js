// Direct Google Sheets CSV fetcher — no backend needed
// Uses the publicly readable CSV export URL

const SHEET_ID = '1NvM2cZEeLWScclaoO6Lf0JpSNuaBhxms9P4UdZSPJSk'
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=827982961`

// ─── Config ─────────────────────────────────────────────────────
export const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
export const REFRESH_COUNTDOWN     = 5 * 60        // seconds

// ─── Date helpers ────────────────────────────────────────────────
export function normalizeDateStr(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (m) {
    const [, y, mo, d] = m
    return `${y}/${String(parseInt(mo)).padStart(2,'0')}/${String(parseInt(d)).padStart(2,'0')}`
  }
  // fallback: JS Date parsing
  const d = new Date(s.replace(/\//g, '-'))
  if (isNaN(d)) return s
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
}

export function getDateRange(period) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  let start, end = new Date(y, m+1, 0)

  switch (period) {
    case 'week':
      start = new Date(now); start.setDate(now.getDate() - 7)
      break
    case 'month':
      start = new Date(y, m, 1); end = new Date(y, m+1, 0)
      break
    case 'quarter':
      start = new Date(y, Math.floor(m/3)*3, 1); end = new Date(y, Math.floor(m/3)*3+3, 0)
      break
    case 'half':
      start = new Date(y, m >= 6 ? 6 : 0, 1); end = new Date(y, m >= 6 ? 12 : 6, 0)
      break
    case 'year':
      start = new Date(y, 0, 1); end = new Date(y, 11, 31)
      break
    default:
      start = new Date(y, m, 1); end = new Date(y, m+1, 0)
  }
  return {
    start: `${start.getFullYear()}/${String(start.getMonth()+1).padStart(2,'0')}/${String(start.getDate()).padStart(2,'0')}`,
    end:   `${end.getFullYear()}/${String(end.getMonth()+1).padStart(2,'0')}/${String(end.getDate()).padStart(2,'0')}`,
  }
}

// ─── CSV fetch + parse ──────────────────────────────────────────
let _cache = null
let _cacheTs = 0

export function clearCache() {
  _cache = null
  _cacheTs = 0
}

export async function getAllData() {
  const now = Date.now()
  if (_cache && now - _cacheTs < AUTO_REFRESH_INTERVAL) return _cache
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`)
  const text = await res.text()
  const lines = text.trim().split('\n')
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',')
    return {
      timestamp: cols[0] || '',
      date:      normalizeDateStr(cols[1]) || '',
      name:      cols[2]?.trim() || '',
      subgroup:  cols[3]?.trim() || '',
      newFriends: parseInt(cols[4]) || 0,
    }
  })
  _cache = rows.filter(r => r.date && r.subgroup)
  _cacheTs = now
  return _cache
}

// ─── API-like functions (same signatures as serverless handlers) ─

export async function fetchDates() {
  const data = await getAllData()
  const dates = [...new Set(data.map(r => r.date))].sort((a, b) => b.localeCompare(a))
  return { dates }
}

export async function fetchAnalytics(date) {
  const data = await getAllData()
  const filtered = data.filter(r => r.date === date)

  const subGroupData = []
  const subgroupMap = {}
  let totalPartners = 0, totalNewFriends = 0

  for (const row of filtered) {
    if (!subgroupMap[row.subgroup]) {
      subgroupMap[row.subgroup] = { name: row.subgroup, partners: 0, newFriends: 0, total: 0, attendees: [] }
    }
    const g = subgroupMap[row.subgroup]
    // 1. 該夥伴本人
    g.partners++
    g.attendees.push({ name: row.name, type: 'partner' })
    // 2. 展開新朋友：張大山的、新朋友-1, -2, ...
    for (let i = 1; i <= row.newFriends; i++) {
      g.newFriends++
      g.attendees.push({ name: `${row.name}的新朋友-${i}`, type: 'friend' })
    }
    g.total = g.partners + g.newFriends
    totalPartners++
    totalNewFriends += row.newFriends
  }

  for (const key of Object.keys(subgroupMap)) subGroupData.push(subgroupMap[key])

  return {
    subGroupData,
    totalPartners,
    totalNewFriends,
    grandTotal: totalPartners + totalNewFriends,
  }
}

export async function fetchTrend(startDate, endDate) {
  const data = await getAllData()
  const filtered = data.filter(r => r.date >= startDate && r.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Group by date
  const byDate = {}
  for (const row of filtered) {
    if (!byDate[row.date]) byDate[row.date] = { partners: 0, newFriends: 0 }
    byDate[row.date].partners++
    byDate[row.date].newFriends += row.newFriends
  }

  const labels = Object.keys(byDate).sort()
  const totalPartners = filtered.length
  const totalNewFriends = filtered.reduce((s, r) => s + r.newFriends, 0)

  const trendData = {
    labels,
    datasets: [
      { label: '總出席', data: labels.map(d => byDate[d].partners + byDate[d].newFriends) },
      { label: '夥伴',   data: labels.map(d => byDate[d].partners) },
      { label: '新朋友', data: labels.map(d => byDate[d].newFriends) },
    ],
    subGroupDatasets: [],
  }

  // Subgroup trends
  const subgroups = [...new Set(data.map(r => r.subgroup))]
  const dateSet = new Set(labels)
  for (const sg of subgroups.slice(0, 6)) {
    const sgData = filtered.filter(r => r.subgroup === sg)
    const sgByDate = {}
    for (const row of sgData) {
      if (!sgByDate[row.date]) sgByDate[row.date] = 0
      sgByDate[row.date]++
    }
    trendData.subGroupDatasets.push({
      label: sg,
      data: labels.map(d => sgByDate[d] || 0),
    })
  }

  return {
    trendData,
    analysis: { totalPartners, totalNewFriends, grandTotal: totalPartners + totalNewFriends },
  }
}

export async function fetchComparison(period) {
  const data = await getAllData()
  const { start: currStart, end: currEnd } = getDateRange(period)
  const currLen = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : period === 'half' ? 180 : 365

  const currStartDate = new Date()
  currStartDate.setDate(currStartDate.getDate() - currLen)
  const prevStart = `${currStartDate.getFullYear()}/${String(currStartDate.getMonth()+1).padStart(2,'0')}/${String(currStartDate.getDate()).padStart(2,'0')}`

  const prevEndDate = new Date(currStartDate)
  prevEndDate.setDate(prevEndDate.getDate() - 1)
  const prevEnd = `${prevEndDate.getFullYear()}/${String(prevEndDate.getMonth()+1).padStart(2,'0')}/${String(prevEndDate.getDate()).padStart(2,'0')}`

  const periodLabel = { week:'本週', month:'本月', quarter:'本季', half:'半年', year:'本年' }[period] || period
  const prevLabel  = { week:'上週', month:'上月', quarter:'上季', half:'上半年', year:'去年' }[period] || '前期'

  function summarize(subset) {
    let tp = 0, tn = 0
    for (const r of subset) { tp++; tn += r.newFriends }
    return { totalPartners: tp, totalNewFriends: tn, grandTotal: tp + tn }
  }

  const current  = summarize(data.filter(r => r.date >= currStart && r.date <= currEnd))
  const previous = summarize(data.filter(r => r.date >= prevStart && r.date <= prevEnd))

  function rate(c, p) {
    if (!p) return c > 0 ? 100 : 0
    return ((c - p) / p) * 100
  }

  return {
    currentPeriod:  { ...current,  label: periodLabel },
    previousPeriod: { ...previous, label: prevLabel },
    growthRates: {
      grandTotal: rate(current.grandTotal,  previous.grandTotal),
      partner:    rate(current.totalPartners,  previous.totalPartners),
      newFriend:  rate(current.totalNewFriends, previous.totalNewFriends),
    },
  }
}
