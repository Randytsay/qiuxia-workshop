// Direct Google Sheets CSV fetcher — no backend needed
// Uses the publicly readable CSV export URL

const SHEET_ID = '1NvM2cZEeLWScclaoO6Lf0JpSNuaBhxms9P4UdZSPJSk'
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=827982961`

// ─── Config ─────────────────────────────────────────────────────
// ─── Config ─────────────────────────────────────────────────────
export const AUTO_REFRESH_INTERVAL = 0 // Auto-refresh disabled


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

function getWeekKey(dateStr) {
  const d = new Date(dateStr.replace(/\//g, '-'))
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Start from Monday
  const monday = new Date(d.setDate(diff))
  return `${monday.getFullYear()}/W${String(Math.ceil(monday.getDate() / 7)).padStart(2,'0')} (${monday.getMonth()+1}/${monday.getDate()})`
}

function getMonday(dateStr) {
  const d = new Date(dateStr.replace(/\//g, '-'))
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return `${monday.getFullYear()}/${String(monday.getMonth()+1).padStart(2,'0')}/${String(monday.getDate()).padStart(2,'0')}`
}

export function getDateRange(period) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  let start, end = new Date(y, m+1, 0)

  switch (period) {
    case 'week':
      start = new Date(now); start.setDate(now.getDate() - 6)
      end = new Date(now)
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

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'; i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export async function getAllData() {
  const now = Date.now()
  if (_cache && now - _cacheTs < AUTO_REFRESH_INTERVAL) return _cache
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`)
  const text = await res.text()
  const lines = text.trim().split('\n')
  
  // Use robust CSV parsing
  const rows = lines.slice(1).map(line => {
    const cols = parseCSVLine(line)
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
      g.attendees.push({ name: row.newFriends === 1 ? `${row.name}的新朋友` : `${row.name}的新朋友-${i}`, type: 'friend' })
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
  
  // Normalize input dates (handle YYYY-MM-DD from <input type="date">)
  const start = normalizeDateStr(startDate)
  const end   = normalizeDateStr(endDate)
  
  const filtered = data.filter(r => r.date >= start && r.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Determine granularity: if > 14 days, group by week
  const sObj = new Date(start.replace(/\//g, '-'))
  const eObj = new Date(end.replace(/\//g, '-'))
  const durationDays = (eObj - sObj) / (1000 * 3600 * 24)
  const useWeekly = durationDays > 14

  const byKey = {}
  const getKey = (dateStr) => useWeekly ? getMonday(dateStr) : dateStr

  // Pre-calculate aggregate data
  for (const row of filtered) {
    const key = getKey(row.date)
    if (!byKey[key]) byKey[key] = { partners: 0, newFriends: 0 }
    byKey[key].partners++
    byKey[key].newFriends += row.newFriends
  }

  // Generate full range of labels
  const labels = []
  const curr = new Date(sObj)
  while (curr <= eObj) {
    const dStr = `${curr.getFullYear()}/${String(curr.getMonth()+1).padStart(2,'0')}/${String(curr.getDate()).padStart(2,'0')}`
    const key = getKey(dStr)
    if (!labels.includes(key)) labels.push(key)
    
    if (useWeekly) curr.setDate(curr.getDate() + 7)
    else curr.setDate(curr.getDate() + 1)
  }
  labels.sort()

  const totalPartners = filtered.length
  const totalNewFriends = filtered.reduce((s, r) => s + r.newFriends, 0)

  const trendData = {
    labels,
    isWeekly: useWeekly,
    datasets: [
      { label: '總出席', data: labels.map(d => (byKey[d]?.partners || 0) + (byKey[d]?.newFriends || 0)), fill: true },
      { label: '夥伴',   data: labels.map(d => byKey[d]?.partners || 0), fill: false },
      { label: '新朋友', data: labels.map(d => byKey[d]?.newFriends || 0), fill: false },
    ],
    subGroupDatasets: [],
  }

  // Get all subgroups that have data within this filtered range
  const rangeSgCounts = {}
  filtered.forEach(r => {
    if (!rangeSgCounts[r.subgroup]) rangeSgCounts[r.subgroup] = 0
    rangeSgCounts[r.subgroup]++
  })
  
  const activeSubgroups = Object.entries(rangeSgCounts)
    .sort((a, b) => b[1] - a[1])
    .map(e => e[0])

  for (const sg of activeSubgroups) {
    const sgData = filtered.filter(r => r.subgroup === sg)
    const sgByKey = {}
    for (const row of sgData) {
      const key = getKey(row.date)
      if (!sgByKey[key]) sgByKey[key] = 0
      sgByKey[key]++
    }
    trendData.subGroupDatasets.push({
      label: sg,
      data: labels.map(d => sgByKey[d] || 0),
      fill: false,
      tension: 0.3,
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
  const fmt = (d) => `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`

  let prevStart, prevEnd
  const cStart = new Date(currStart)
  
  if (period === 'week') {
    const pEndObj = new Date(cStart)
    pEndObj.setDate(pEndObj.getDate() - 1)
    const pStartObj = new Date(pEndObj)
    pStartObj.setDate(pStartObj.getDate() - 6)
    prevStart = fmt(pStartObj)
    prevEnd = fmt(pEndObj)
  } else if (period === 'month') {
    const pStartObj = new Date(cStart.getFullYear(), cStart.getMonth() - 1, 1)
    const pEndObj = new Date(cStart.getFullYear(), cStart.getMonth(), 0)
    prevStart = fmt(pStartObj)
    prevEnd = fmt(pEndObj)
  } else if (period === 'quarter') {
    const pStartObj = new Date(cStart.getFullYear(), cStart.getMonth() - 3, 1)
    const pEndObj = new Date(cStart.getFullYear(), cStart.getMonth(), 0)
    prevStart = fmt(pStartObj)
    prevEnd = fmt(pEndObj)
  } else if (period === 'year') {
    const pStartObj = new Date(cStart.getFullYear() - 1, 0, 1)
    const pEndObj = new Date(cStart.getFullYear() - 1, 11, 31)
    prevStart = fmt(pStartObj)
    prevEnd = fmt(pEndObj)
  } else {
    // Fallback for others
    const pEndObj = new Date(cStart)
    pEndObj.setDate(pEndObj.getDate() - 1)
    prevEnd = fmt(pEndObj)
    prevStart = "2020/01/01" // dummy
  }

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
    currentPeriod:  { ...current,  label: periodLabel, range: `${currStart} ~ ${currEnd}` },
    previousPeriod: { ...previous, label: prevLabel,   range: `${prevStart} ~ ${prevEnd}` },
    growthRates: {
      grandTotal: rate(current.grandTotal,  previous.grandTotal),
      partner:    rate(current.totalPartners,  previous.totalPartners),
      newFriend:  rate(current.totalNewFriends, previous.totalNewFriends),
    },
  }
}
