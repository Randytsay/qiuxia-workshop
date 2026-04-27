import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import {
  fetchDates, fetchAnalytics, fetchTrend, fetchComparison, clearCache,
} from './dataService.js'
import { AUTO_REFRESH_INTERVAL } from './dataService.js'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, ChartDataLabels
)

// ─── 工作坊資料 ───────────────────────────────────────
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

// ─── 共用常數 ────────────────────────────────────────────────────
const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316', '#8b5cf6',
  '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#d946ef',
]

// ─── Helpers ────────────────────────────────────────────────────
function fmtDate(d) {
  try {
    const [y, mo, day] = d.split('/')
    return `${y}年${parseInt(mo)}月${parseInt(day)}日`
  } catch { return d }
}

function fmtDateShort(d) {
  try {
    const parts = d.split('/')
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`
  } catch { return d }
}

// ─── 頂層導航按鈕 ────────────────────────────────────────────────
function TopNavBtn({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl text-sm font-bold transition-all border-2 min-h-[52px] ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200'
          : 'bg-white text-slate-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function GrowthBadge({ rate }) {
  if (rate === null || isNaN(rate)) return <span className="text-gray-400">—</span>
  const color = rate >= 0 ? 'text-green-600' : 'text-red-500'
  const icon = rate >= 0 ? '▲' : '▼'
  return <span className={`font-bold ${color}`}>{icon} {Math.abs(rate).toFixed(1)}%</span>
}

// ─── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, primary, sub, delay = 0 }) {
  return (
    <div
      className={`rounded-2xl p-5 shadow-card card-hover relative overflow-hidden animate-fade-slide-up ${primary
        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-200/50'
        : 'bg-white border border-gray-100/80'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* 頂部漸層裝飾線 */}
      {primary && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
      )}
      {!primary && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-300/50 via-purple-300/50 to-pink-300/50 opacity-0 group-hover:opacity-100 transition" />
      )}
      <p className={`text-sm mb-1 font-medium tracking-wide ${primary ? 'text-white/80' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-3xl font-black tracking-tighter number-count ${primary ? '' : 'text-gray-800'}`}>{value ?? '—'}</p>
      {sub && <p className={`text-xs mt-1 ${primary ? 'text-white/60' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}

// ─── Tab Button ─────────────────────────────────────────────────
function TabBtn({ id, label, icon, active, onClick }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
          : 'text-slate-500 hover:bg-gray-100'
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════
//  區塊一：秋霞大C 出席儀表板（原有功能）
// ════════════════════════════════════════════════════════════════

// ─── Single Meeting Tab ──────────────────────────────────────────
function SingleTab({ dates, selectedDate, onDateChange, data, loading }) {
  const barChartRef = useRef(null)
  const [chartKey, setChartKey] = useState(0)

  useEffect(() => {
    if (data) setChartKey(k => k + 1)
  }, [selectedDate])

  const sorted = data?.subGroupData
    ? [...data.subGroupData].sort((a, b) => b.total - a.total)
    : []

  const barData = {
    labels: sorted.map(g => g.name.length > 8 ? g.name.slice(0, 8) + '…' : g.name),
    datasets: [
      { label: '夥伴', data: sorted.map(g => g.partners), backgroundColor: '#3b82f6' },
      { label: '新朋友', data: sorted.map(g => g.newFriends), backgroundColor: '#a5b4fc' },
    ],
  }

  const barOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'rect' } },
      datalabels: { color: '#fff', font: { weight: 'bold', size: 11 }, anchor: 'center', align: 'center', formatter: v => v > 0 ? v : '' },
    },
    scales: { x: { stacked: true, grid: { color: 'rgba(0,0,0,0.04)' } }, y: { stacked: true, grid: { display: false } } },
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <label className="block text-sm font-semibold text-gray-600 mb-3">📅 依簽到日期查詢</label>
        <select
          value={selectedDate}
          onChange={e => onDateChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">— 選擇日期 —</option>
          {(dates || []).map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
        </select>
      </div>

      {loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            {[0,1,2].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
          <div className="skeleton h-72 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="👥 夥伴數" value={data.totalPartners} delay={0} />
            <StatCard label="🆕 新朋友數" value={data.totalNewFriends} delay={80} />
            <StatCard label="✨ 總出席" value={data.grandTotal} primary delay={160} />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">📊 各小C出席分佈</h3>
            <div className="relative" style={{ height: Math.max(300, sorted.length * 52 + 80) }}>
              <Bar key={chartKey} ref={barChartRef} data={barData} options={barOptions} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">📋 各小C出席詳情</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">小C名稱</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">夥伴</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">新朋友</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">總計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((g, i) => (
                    <tr key={i} className="hover:bg-blue-50/30 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{g.name}</td>
                      <td className="px-4 py-3 text-center">{g.partners}</td>
                      <td className="px-4 py-3 text-center text-blue-600">{g.newFriends}</td>
                      <td className="px-4 py-3 text-center font-bold">{g.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-50 font-bold">
                  <tr>
                    <td className="px-4 py-3">合計</td>
                    <td className="px-4 py-3 text-center">{data.totalPartners}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{data.totalNewFriends}</td>
                    <td className="px-4 py-3 text-center text-blue-700">{data.grandTotal}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {sorted.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">👥 出席夥伴名單</h3>
              <div className="space-y-4">
                {sorted.map((g, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-800">{g.name}</h4>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">{g.attendees?.length || 0}人</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(g.attendees || []).map((a, j) => (
                        <span key={j} className={`text-xs px-2.5 py-1 rounded-full font-medium ${a.type === 'friend' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-gray-100 text-gray-700'}`}>
                          {a.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📅</p>
          <p>請選擇日期查看出席資料</p>
        </div>
      )}
    </div>
  )
}

// ─── Trend Tab ─────────────────────────────────────────────────
function TrendTab({ data, loading, onQuery, trendPeriod, onPeriodChange }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (trendPeriod === 'thisMonth') {
      const t = new Date()
      const y = t.getFullYear(), m = t.getMonth()
      setStartDate(`${y}-${String(m+1).padStart(2,'0')}-01`)
      setEndDate(`${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`)
    } else if (trendPeriod === 'lastMonth') {
      const t = new Date()
      const y = t.getFullYear(), m = t.getMonth() - 1
      setStartDate(`${y}-${String(m+1).padStart(2,'0')}-01`)
      setEndDate(`${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`)
    } else if (trendPeriod === 'thisQuarter') {
      const t = new Date()
      const q = Math.floor(t.getMonth() / 3)
      setStartDate(`${t.getFullYear()}-${String(q*3+1).padStart(2,'0')}-01`)
      const eq = new Date(t.getFullYear(), q*3+3, 0)
      setEndDate(`${eq.getFullYear()}-${String(eq.getMonth()+1).padStart(2,'0')}-${eq.getDate()}`)
    }
  }, [trendPeriod])

  const quickBtns = [
    { id: 'thisMonth', label: '本月' },
    { id: 'lastMonth', label: '上個月' },
    { id: 'thisQuarter', label: '本季' },
  ]

  const lineData = data?.trendData ? {
    labels: data.trendData.labels.map(fmtDateShort),
    datasets: data.trendData.datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: CHART_COLORS[i],
      backgroundColor: CHART_COLORS[i] + '20',
      tension: 0.3,
      fill: i === 0,
    })),
  } : null

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { usePointStyle: true } }, datalabels: { display: false } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
  }

  const subGroupData = data?.trendData?.subGroupDatasets?.slice(0, 6) || []
  const subLineData = {
    labels: data?.trendData?.labels?.map(fmtDateShort) || [],
    datasets: subGroupData.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: CHART_COLORS[i % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '15',
      tension: 0.3,
    })),
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <label className="block text-sm font-semibold text-gray-600 mb-3">⚡ 快速選擇</label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {quickBtns.map(b => (
            <button
              key={b.id}
              onClick={() => onPeriodChange(b.id)}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                trendPeriod === b.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <label className="block text-sm font-semibold text-gray-600 mb-3">📆 或自訂區間</label>
        <div className="space-y-2 mb-3">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <button
          onClick={() => onQuery(startDate, endDate)}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
        >
          🔍 查詢趨勢
        </button>
      </div>

      {loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            {[0,1,2].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
          <div className="skeleton h-72 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="👥 期間夥伴" value={data.analysis?.totalPartners} />
            <StatCard label="🆕 期間新朋友" value={data.analysis?.totalNewFriends} />
            <StatCard label="📈 總出席" value={data.analysis?.grandTotal} primary />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">📈 總出席人數趨勢</h3>
            <div className="relative" style={{ height: 280 }}>
              {lineData && <Line data={lineData} options={lineOptions} />}
            </div>
          </div>

          {subGroupData.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">📈 各小C出席趨勢</h3>
              <div className="relative" style={{ height: 300 }}>
                <Line data={subLineData} options={lineOptions} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Comparison Tab ─────────────────────────────────────────────
function ComparisonTab({ data, loading, onPeriodChange, activePeriod }) {
  const chartRef = useRef(null)

  const doughnutData = data ? {
    labels: ['夥伴', '新朋友'],
    datasets: [{
      data: [data.currentPeriod.totalPartners, data.currentPeriod.totalNewFriends],
      backgroundColor: ['#3b82f6', '#a5b4fc'],
      borderWidth: 2,
      borderColor: '#fff',
    }],
  } : null

  const compBarData = data ? {
    labels: ['總人數', '夥伴', '新朋友'],
    datasets: [
      { label: data.previousPeriod.label, data: [data.previousPeriod.grandTotal, data.previousPeriod.totalPartners, data.previousPeriod.totalNewFriends], backgroundColor: '#9ca3af' },
      { label: data.currentPeriod.label, data: [data.currentPeriod.grandTotal, data.currentPeriod.totalPartners, data.currentPeriod.totalNewFriends], backgroundColor: '#3b82f6' },
    ],
  } : null

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' }, datalabels: { display: false } },
    scales: { y: { beginAtZero: true } },
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      datalabels: { color: '#fff', font: { weight: 'bold', size: 13 }, formatter: v => v > 0 ? v : '' },
    },
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <label className="block text-sm font-semibold text-gray-600 mb-3">📊 選擇比較區間</label>
        <div className="grid grid-cols-5 gap-2">
          {[{ id: 'week', label: '週' }, { id: 'month', label: '月' }, { id: 'quarter', label: '季' }, { id: 'half', label: '半年' }, { id: 'year', label: '年' }].map(b => (
            <button
              key={b.id}
              onClick={() => onPeriodChange(b.id)}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                activePeriod === b.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {b.label}比較
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            {[0,1,2].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
          <div className="skeleton h-72 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-2">總出席人數</p>
              <p className="text-2xl font-extrabold text-gray-800">{data.currentPeriod.grandTotal}</p>
              <p className="text-xs text-gray-400 mt-1">{data.previousPeriod.label}: {data.previousPeriod.grandTotal}</p>
              <div className="mt-1"><GrowthBadge rate={data.growthRates.grandTotal} /></div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-2">夥伴人數</p>
              <p className="text-2xl font-extrabold text-gray-800">{data.currentPeriod.totalPartners}</p>
              <p className="text-xs text-gray-400 mt-1">{data.previousPeriod.label}: {data.previousPeriod.totalPartners}</p>
              <div className="mt-1"><GrowthBadge rate={data.growthRates.partner} /></div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-2">新朋友人數</p>
              <p className="text-2xl font-extrabold text-gray-800">{data.currentPeriod.totalNewFriends}</p>
              <p className="text-xs text-gray-400 mt-1">{data.previousPeriod.label}: {data.previousPeriod.totalNewFriends}</p>
              <div className="mt-1"><GrowthBadge rate={data.growthRates.newFriend} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">🥧 {data.currentPeriod.label} 組成</h3>
              <div className="relative" style={{ height: 240 }}>
                {doughnutData && <Doughnut ref={chartRef} data={doughnutData} options={doughnutOptions} />}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">📊 {data.currentPeriod.label} vs {data.previousPeriod.label}</h3>
              <div className="relative" style={{ height: 240 }}>
                {compBarData && <Bar data={compBarData} options={barOptions} />}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  區塊二：工作坊統計儀表板
// ════════════════════════════════════════════════════════════════

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    if (values.length >= headers.length) {
      const row = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })
      rows.push(row)
    }
  }
  return rows
}

function KPICard({ title, value, sub, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-card card-hover relative overflow-hidden animate-fade-slide-up">
      <p className="text-sm text-gray-400 mb-1 font-medium tracking-wide">{title}</p>
      <p className="text-3xl font-black tracking-tighter number-count" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10" style={{ background: color, filter: 'blur(16px)', transform: 'translate(30%, -30%)' }} />
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

const WORKSHOP_SHEET_ID = '1QEytkFQTYVgkwCxgcC4BKrvf9ZkC_GApJd1U6JQAnsI'
const WORKSHOP_API_KEY = 'v2.BYXneOcP6Bv73dvpyiE_tUZQtFxobX4KB3ruQWCMxOfveEkzVnmOwUk5ugf9H2K_QjOQRG4jxEJkONVa6oJ0K38OBygg0LtRx2lw-hF5zIU6WC9Jrz5t3rlx'
const WORKSHOP_SHEET_NAME = '簽到記錄表'
const WORKSHOP_CSV_URL = `https://docs.google.com/spreadsheets/d/${WORKSHOP_SHEET_ID}/export?format=csv&gid=348335718`

const COLOR_GRADIENTS = [
  ['#5470c6', '#2c3e88'],
  ['#91cc75', '#3f8a2f'],
  ['#fac858', '#d99c0d'],
  ['#ee6666', '#b13939'],
  ['#73c0de', '#3b8dad'],
  ['#ea7ccc', '#b13e8f'],
  ['#63D4A3', '#34A87C'],
  ['#fc8452', '#d95b21'],
  ['#9a60b4', '#6b3e81'],
]

function getItemStyleForChart(index, chartType = 'bar', orientation = 'vertical') {
  const gradient = COLOR_GRADIENTS[index % COLOR_GRADIENTS.length]
  let itemStyle = {
    color: {
      type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [{ offset: 0, color: gradient[0] }, { offset: 1, color: gradient[1] }]
    },
    borderRadius: 4,
    shadowBlur: 10,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffsetX: 0,
    shadowOffsetY: 1,
    borderWidth: chartType === 'rose' ? 0.5 : 0,
    borderColor: chartType === 'rose' ? 'rgba(0,0,0,0.1)' : undefined
  }
  if (chartType === 'bar') {
    itemStyle.borderRadius = orientation === 'vertical' ? [4, 4, 0, 0] : [0, 4, 4, 0]
    itemStyle.shadowColor = 'rgba(0,0,0,0.15)'
    itemStyle.shadowOffsetY = 2
    if (orientation === 'horizontal') {
      itemStyle.color.x2 = 1
      itemStyle.color.y2 = 0
    }
  } else if (chartType === 'rose') {
    itemStyle.borderRadius = 6
  }
  return itemStyle
}

function WorkshopTab() {
  // 新工作坊頁面直接用 iframe 嵌入獨立 HTML（自行從 Google Sheets CSV 抓資料）
  return (
    <div className="w-full" style={{ height: 'calc(100vh - 160px)', minHeight: '600px' }}>
      <iframe
        src="/workshop.html"
        title="秋霞大C工作坊統計"
        style={{ width: '100%', height: '100%', border: 'none' }}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  )
}
// ════════════════════════════════════════════════════════════════
//  主程式：頂層雙儀表板導航
// ════════════════════════════════════════════════════════════════

// ─── 秋霞大C 出席儀表板（子分頁） ────────────────────────────────
function WeiHongDashboard() {
  const [activeTab, setActiveTab] = useState('single')
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [singleData, setSingleData] = useState(null)
  const [trendData, setTrendData] = useState(null)
  const [trendPeriod, setTrendPeriod] = useState('thisMonth')
  const [compData, setCompData] = useState(null)
  const [compPeriod, setCompPeriod] = useState('week')
  const [loadingSingle, setLoadingSingle] = useState(false)
  const [loadingTrend, setLoadingTrend] = useState(false)
  const [loadingComp, setLoadingComp] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL / 1000)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const compPeriodRef = useRef(compPeriod)

  useEffect(() => { compPeriodRef.current = compPeriod }, [compPeriod])

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { handleRefresh(); return AUTO_REFRESH_INTERVAL / 1000 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  function handleRefresh() {
    setIsRefreshing(true)
    setCountdown(AUTO_REFRESH_INTERVAL / 1000)
    clearCache()
    Promise.all([
      fetchDates(),
      selectedDate ? fetchAnalytics(selectedDate) : Promise.resolve(),
      fetchComparison(compPeriodRef.current),
    ]).then(([d, ad, cd]) => {
      if (d.dates?.length) { setDates(d.dates); if (!selectedDate) setSelectedDate(d.dates[0]) }
      if (ad) setSingleData(ad)
      if (cd) setCompData(cd)
      setLastUpdated(new Date())
      setIsRefreshing(false)
    }).catch(e => { console.error(e); setIsRefreshing(false) })
  }

  function refreshAll() {
    setIsRefreshing(true)
    clearCache()
    Promise.all([
      fetchDates(),
      selectedDate ? fetchAnalytics(selectedDate) : Promise.resolve(),
      trendData && trendPeriod ? fetchTrendByPeriod() : Promise.resolve(),
      fetchComparison(compPeriodRef.current),
    ]).then(([d, ad, td, cd]) => {
      if (d.dates?.length) { setDates(d.dates); setSelectedDate(prev => prev || d.dates[0]) }
      if (ad) setSingleData(ad)
      if (td) setTrendData(td)
      if (cd) setCompData(cd)
      setLastUpdated(new Date())
      setCountdown(AUTO_REFRESH_INTERVAL / 1000)
      setIsRefreshing(false)
    }).catch(e => { console.error(e); setIsRefreshing(false) })
  }

  function fetchTrendByPeriod() {
    const t = new Date()
    const y = t.getFullYear(), m = t.getMonth()
    let start, end
    if (trendPeriod === 'thisMonth') {
      start = `${y}-${String(m+1).padStart(2,'0')}-01`
      end   = `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`
    } else if (trendPeriod === 'lastMonth') {
      start = `${y}-${String(m).padStart(2,'0')}-01`
      end   = `${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`
    } else {
      const q = Math.floor(m/3)
      start = `${y}-${String(q*3+1).padStart(2,'0')}-01`
      const eq = new Date(y, q*3+3, 0)
      end = `${eq.getFullYear()}-${String(eq.getMonth()+1).padStart(2,'0')}-${String(eq.getDate()).padStart(2,'0')}`
    }
    return fetchTrend(start, end)
  }

  // Initial load
  useEffect(() => {
    fetchDates()
      .then(d => {
        if (d.dates?.length) {
          setDates(d.dates)
          setSelectedDate(d.dates[0])
          setLastUpdated(new Date())
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    setLoadingSingle(true)
    fetchAnalytics(selectedDate)
      .then(d => { setSingleData(d); setLoadingSingle(false); })
      .catch(e => { console.error(e); setLoadingSingle(false); })
  }, [selectedDate])

  useEffect(() => { fetchComp('week') }, [])

  function fetchComp(period) {
    setLoadingComp(true)
    fetchComparison(period)
      .then(d => { setCompData(d); setLoadingComp(false); })
      .catch(e => { console.error(e); setLoadingComp(false); })
  }

  function handleTrendQuery(start, end) {
    if (!start || !end) return
    setLoadingTrend(true)
    fetchTrend(start, end)
      .then(d => { setTrendData(d); setLoadingTrend(false); })
      .catch(e => { console.error(e); setLoadingTrend(false); })
  }

  function handlePeriodChange(p) {
    setTrendPeriod(p)
    setLoadingTrend(true)
    fetchTrendByPeriod()
      .then(d => { setTrendData(d); setLoadingTrend(false); })
      .catch(e => { console.error(e); setLoadingTrend(false); })
  }

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white px-5 py-4 rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2 mb-0.5">🌸 秋霞大C 出席儀表板</h2>
            <p className="text-blue-200 text-xs">即時分析 Coring 會議狀況</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors text-white text-xs px-3 py-1.5 rounded-xl font-medium disabled:opacity-50"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
              {isRefreshing ? '更新中…' : '刷新'}
            </button>
            {lastUpdated && (
              <div className="text-right">
                <div className="text-blue-200 text-xs">{lastUpdated.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 更新</div>
                <div className="text-blue-300 text-xs mt-0.5">⏱ {countdown}s 後自動刷新</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl p-1.5 shadow-sm flex gap-1">
        <TabBtn id="single" label="單次會議" icon="📅" active={activeTab === 'single'} onClick={() => setActiveTab('single')} />
        <TabBtn id="trend" label="趨勢分析" icon="📈" active={activeTab === 'trend'} onClick={() => setActiveTab('trend')} />
        <TabBtn id="history" label="歷史統計" icon="📊" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
      </div>

      {/* Tab content */}
      {activeTab === 'single' && (
        <SingleTab dates={dates} selectedDate={selectedDate} onDateChange={setSelectedDate} data={singleData} loading={loadingSingle} />
      )}
      {activeTab === 'trend' && (
        <TrendTab data={trendData} loading={loadingTrend} onQuery={handleTrendQuery} trendPeriod={trendPeriod} onPeriodChange={handlePeriodChange} />
      )}
      {activeTab === 'history' && (
        <ComparisonTab data={compData} loading={loadingComp} onPeriodChange={p => { setCompPeriod(p); fetchComp(p); }} activePeriod={compPeriod} />
      )}
    </div>
  )
}

// ─── 主 App：頂層導航 ─────────────────────────────────────────────
export default function App() {
  const [topSection, setTopSection] = useState('weihong') // 'weihong' | 'workshop'

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Global Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🌸</span>
            <div>
              <h1 className="text-base font-black text-gray-900">秋霞大C 教育組</h1>
              <p className="text-xs text-gray-400">數據儀表板</p>
            </div>
          </div>
          {/* Top navigation */}
          <div className="flex gap-2">
            <TopNavBtn
              label="秋霞大C 出席"
              icon="📅"
              active={topSection === 'weihong'}
              onClick={() => setTopSection('weihong')}
            />
            <TopNavBtn
              label="工作坊統計"
              icon="🏆"
              active={topSection === 'workshop'}
              onClick={() => setTopSection('workshop')}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-5">
        {topSection === 'weihong' && <WeiHongDashboard />}
        {topSection === 'workshop' && <WorkshopTab />}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6">
        📌 資料來源：Google 試算表 · 秋霞大C教育組
      </footer>
    </div>
  )
}
