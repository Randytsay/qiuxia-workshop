import { useState, useEffect, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, LineElement, PointElement
)


const WORKSHOP_COLORS = {
  '經營工作坊': '#6366f1',
  '招募工作坊': '#f59e0b',
  '領導工作坊': '#10b981',
  '產品工作坊': '#ec4899',
  'AI工作坊': '#8b5cf6',
  '產品&AI工作坊': '#06b6d4',
  '主題工作坊': '#f97316',
  '主題式工作坊': '#f97316',
  '讀書會': '#84cc16',
  '聯合小C': '#0ea5e9',
  '其他工作坊': '#64748b',
}

const RANK_COLORS = {
  'UFO超連鎖店主': '#fbbf24',
  'SEC資深經理級': '#f59e0b',
  'MC以上': '#ef4444',
  'MC主管經理級': '#ec4899',
  'EC經理級': '#8b5cf6',
  'C助理級': '#6366f1',
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  // Parse headers carefully - handle quoted commas
  const headers = parseCSVLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length >= headers.length) {
      const row = {}
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim().replace(/^"|"$/g, '') })
      rows.push(row)
    }
  }
  return rows
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function KPICard({ title, value, sub, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function SelectFilter({ label, options, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        <option value="">全部</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export default function App() {
  const [rawData, setRawData] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [latestDate, setLatestDate] = useState('')
  const [filters, setFilters] = useState({
    workshopType: '',
    smallC: '',
    rank: '',
    role: '',
    dateRange: '',  // 空字串 = 預設最新一場
  })

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setRawData(json.data)
          setLastUpdated(new Date(json.fetchedAt).toLocaleString('zh-TW'))
          // 抓最新一場工作坊日期
          const dates = json.data.map(r => r['參與工作坊日期']).filter(Boolean)
          if (dates.length > 0) {
            const latest = dates.reduce((a, b) => new Date(a) > new Date(b) ? a : b)
            setLatestDate(latest)
            setFilters(f => ({ ...f, dateRange: latest }))
          }
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Data load error:', err)
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    return rawData.filter(row => {
      if (filters.workshopType && row['請選擇這場工作坊的類別'] !== filters.workshopType) return false
      if (filters.smallC && row['所屬小C'] !== filters.smallC) return false
      if (filters.rank && row['目前聘階'] !== filters.rank) return false
      if (filters.role && row['參與者身分'] !== filters.role) return false
      if (filters.dateRange) {
        const dateStr = row['參與工作坊日期']
        if (!dateStr) return false
        // 精確匹配日期（最新一場或多場選定）
        if (dateStr !== filters.dateRange) return false
      }
      return true
    })
  }, [rawData, filters])

  const workshopTypes = useMemo(() => {
    const set = new Set(rawData.map(r => r['請選擇這場工作坊的類別']).filter(Boolean))
    return Array.from(set).sort()
  }, [rawData])

  const smallCs = useMemo(() => {
    const set = new Set(rawData.map(r => r['所屬小C']).filter(Boolean))
    return Array.from(set).sort()
  }, [rawData])

  const ranks = useMemo(() => {
    const set = new Set(rawData.map(r => r['目前聘階']).filter(Boolean))
    return Array.from(set).sort()
  }, [rawData])

  const roles = useMemo(() => {
    const set = new Set(rawData.map(r => r['參與者身分']).filter(Boolean))
    return Array.from(set).sort()
  }, [rawData])

  // 所有可用日期（由新到舊排列）
  const availableDates = useMemo(() => {
    const set = new Set(rawData.map(r => r['參與工作坊日期']).filter(Boolean))
    return Array.from(set).sort((a, b) => new Date(b) - new Date(a))
  }, [rawData])

  // KPIs
  const totalRecords = filtered.length
  const uniquePersons = new Set(filtered.map(r => r['夥伴姓'] + r['名字'])).size
  const filteredWorkshopTypes = new Set(filtered.map(r => r['請選擇這場工作坊的類別']).filter(Boolean)).size
  const totalSessions = availableDates.length
  const repeatRate = totalRecords > 0 && uniquePersons > 0
    ? ((totalRecords / uniquePersons - 1) * 100).toFixed(1) + '%'
    : '0%'

  // 月份趨勢
  const monthlyData = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const d = r['參與工作坊日期']
      if (!d) return
      const m = d.substring(0, 7)
      map[m] = (map[m] || 0) + 1
    })
    const sorted = Object.keys(map).sort()
    return {
      labels: sorted,
      datasets: [{
        label: '參與人次',
        data: sorted.map(k => map[k]),
        backgroundColor: 'rgba(99,102,241,0.7)',
        borderRadius: 6,
      }]
    }
  }, [filtered])

  // 工作坊類別
  const workshopTypeData = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const t = r['請選擇這場工作坊的類別'] || '未知'
      map[t] = (map[t] || 0) + 1
    })
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
    return {
      labels: sorted.map(([k]) => k),
      datasets: [{
        data: sorted.map(([, v]) => v),
        backgroundColor: sorted.map(([k]) => WORKSHOP_COLORS[k] || '#94a3b8'),
        borderWidth: 0,
      }]
    }
  }, [filtered])

  // 小C排行
  const smallCData = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const c = r['所屬小C'] || '未知'
      map[c] = (map[c] || 0) + 1
    })
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
    return {
      labels: sorted.map(([k]) => k),
      datasets: [{
        label: '參與人次',
        data: sorted.map(([, v]) => v),
        backgroundColor: 'rgba(99,102,241,0.7)',
        borderRadius: 6,
      }]
    }
  }, [filtered])

  // 出席王
  const topAttendeesData = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const name = (r['夥伴姓'] || '') + (r['名字'] || '')
      if (!name) return
      map[name] = (map[name] || 0) + 1
    })
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
    return {
      labels: sorted.map(([k]) => k),
      datasets: [{
        label: '參加次數',
        data: sorted.map(([, v]) => v),
        backgroundColor: 'rgba(245,158,11,0.7)',
        borderRadius: 6,
      }]
    }
  }, [filtered])

  // 職級分布
  const rankData = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const t = r['目前聘階'] || '未知'
      map[t] = (map[t] || 0) + 1
    })
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
    return {
      labels: sorted.map(([k]) => k),
      datasets: [{
        data: sorted.map(([, v]) => v),
        backgroundColor: sorted.map(([k]) => RANK_COLORS[k] || '#94a3b8'),
        borderWidth: 0,
      }]
    }
  }, [filtered])

  // 角色分布
  const roleData = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const t = r['參與者身分'] || '未知'
      map[t] = (map[t] || 0) + 1
    })
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
    return {
      labels: sorted.map(([k]) => k),
      datasets: [{
        data: sorted.map(([, v]) => v),
        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899'],
        borderWidth: 0,
      }]
    }
  }, [filtered])

  // 最近場次
  const recentSessions = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const d = r['參與工作坊日期']
      const t = r['請選擇這場工作坊的類別'] || ''
      if (!d) return
      if (!map[d] || map[d].type !== t) {
        map[d] = { date: d, type: t, count: 0, names: [] }
      }
      map[d].count++
      const name = (r['夥伴姓'] || '') + (r['名字'] || '')
      if (name) map[d].names.push(name)
    })
    return Object.values(map)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)
  }, [filtered])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { boxWidth: 12, padding: 8, font: { size: 11 } }
      }
    }
  }

  const clearFilters = () => setFilters({ workshopType: '', smallC: '', rank: '', role: '', dateRange: latestDate || '' })
  const hasActiveFilters = Object.values(filters).some(v => v !== '' && v !== latestDate)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500">正在載入 Google 試算表資料...</p>
          <p className="text-xs text-gray-400 mt-1">自動抓取最新資料，每次刷新即更新</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-1">🌸 秋霞大C 工作坊統計儀表板</h1>
          <p className="text-indigo-200 text-sm">數據自動同步自 Google 試算表 · 最後更新：{lastUpdated}</p>
          <p className="text-indigo-200 text-xs mt-1">
            {filters.dateRange
              ? <>📅 顯示場次：<span className="font-bold text-white">{filters.dateRange}</span> · </>
              : <>📅 顯示全部場次 · </>}
            <span className="font-bold text-white">{totalRecords}</span> 筆記錄 · 原始共 <span className="font-bold text-white">{rawData.length}</span> 筆
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">🔍 篩選器</h2>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-indigo-600 hover:underline">
                清除所有篩選
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SelectFilter label="工作坊類別" options={workshopTypes} value={filters.workshopType} onChange={v => setFilters(f => ({ ...f, workshopType: v }))} />
            <SelectFilter label="所屬小C" options={smallCs} value={filters.smallC} onChange={v => setFilters(f => ({ ...f, smallC: v }))} />
            <SelectFilter label="職級" options={ranks} value={filters.rank} onChange={v => setFilters(f => ({ ...f, rank: v }))} />
            <SelectFilter label="參與角色" options={roles} value={filters.role} onChange={v => setFilters(f => ({ ...f, role: v }))} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">工作坊場次</label>
              <select
                value={filters.dateRange}
                onChange={e => setFilters(f => ({ ...f, dateRange: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">全部場次</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPICard title="📝 總參與人次" value={totalRecords} sub="篩選後" color="#6366f1" />
          <KPICard title="👥 獨立人數" value={uniquePersons} sub="不重複計算" color="#10b981" />
          <KPICard title="🏠 參與小C" value={smallCs.length} sub={`共 ${rawData.length > 0 ? new Set(rawData.map(r => r['所屬小C'])).size : 0} 個小C`} color="#f59e0b" />
          <KPICard title="🔄 複訓率" value={repeatRate} sub="人均參加次數" color="#ec4899" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-4">📈 月份參與趨勢</h3>
            <div className="h-52">
              {monthlyData.labels.length > 0
                ? <Bar data={monthlyData} options={chartOptions} />
                : <p className="text-gray-400 text-sm text-center py-16">暫無資料</p>}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-4">🥧 工作坊類別分布</h3>
            <div className="h-52">
              {workshopTypeData.labels.length > 0
                ? <Doughnut data={workshopTypeData} options={doughnutOptions} />
                : <p className="text-gray-400 text-sm text-center py-16">暫無資料</p>}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-4">🏠 小C參與排行 TOP10</h3>
            <div className="h-52">
              {smallCData.labels.length > 0
                ? <Bar data={smallCData} options={chartOptions} />
                : <p className="text-gray-400 text-sm text-center py-16">暫無資料</p>}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-4">⭐ 出席王 TOP10</h3>
            <div className="h-52">
              {topAttendeesData.labels.length > 0
                ? <Bar data={topAttendeesData} options={chartOptions} />
                : <p className="text-gray-400 text-sm text-center py-16">暫無資料</p>}
            </div>
          </div>
        </div>

        {/* Charts Row 3 */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-4">🏆 職級分布</h3>
            <div className="h-52">
              {rankData.labels.length > 0
                ? <Doughnut data={rankData} options={doughnutOptions} />
                : <p className="text-gray-400 text-sm text-center py-16">暫無資料</p>}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-4">🎭 角色分布</h3>
            <div className="h-52">
              {roleData.labels.length > 0
                ? <Doughnut data={roleData} options={doughnutOptions} />
                : <p className="text-gray-400 text-sm text-center py-16">暫無資料</p>}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-hidden">
            <h3 className="font-semibold text-gray-700 mb-4">📋 最近場次</h3>
            <div className="overflow-y-auto h-44 space-y-2">
              {recentSessions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs border-b border-gray-50 pb-2">
                  <span className="bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 font-medium whitespace-nowrap">{s.date}</span>
                  <span className="text-gray-600 whitespace-nowrap">{s.type}</span>
                  <span className="text-gray-400 ml-auto">{s.count}人</span>
                </div>
              ))}
              {recentSessions.length === 0 && <p className="text-gray-400 text-xs text-center py-8">暫無資料</p>}
            </div>
          </div>
        </div>

        {/* 說明 */}
        <div className="text-center text-xs text-gray-400 mt-6">
          <p>📌 資料來源：Google 試算表（每次開啟自動抓最新）| 秋霞大C教育組</p>
          <p className="mt-1">篩選不改變原始資料，僅影響本頁顯示範圍</p>
        </div>
      </div>
    </div>
  )
}
