import { getAllData, setCorsHeaders, handleOptions, normalizeDateStr, formatDate } from './sheet.js';

export default async function handler(req, res) {
  handleOptions(req, res);
  if (req.method === 'OPTIONS') return;

  const { start, end } = req.query || {};
  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end parameter' });
  }

  try {
    const data = await getAllData();
    const startNorm = normalizeDateStr(start);
    const endNorm = normalizeDateStr(end);

    // Filter rows within date range
    const filtered = data.filter(row => {
      const d = normalizeDateStr(row.date);
      return d >= startNorm && d <= endNorm;
    });

    if (filtered.length === 0) {
      return res.status(200).json({
        trendData: { labels: [], datasets: [], subGroupDatasets: [] },
        analysis: {
          grandTotal: 0,
          totalPartners: 0,
          totalNewFriends: 0,
          partnerGrowthRate: null,
          newFriendGrowthRate: null,
          averageAttendance: 0,
        },
      });
    }

    // Get unique dates in range, sorted
    const dateSet = new Set(filtered.map(r => normalizeDateStr(r.date)));
    const sortedDates = [...dateSet].sort((a, b) => new Date(a) - new Date(b));

    // Group by date
    const byDate = {};
    sortedDates.forEach(d => { byDate[d] = { partners: 0, newFriends: 0, total: 0 }; });
    filtered.forEach(row => {
      const d = normalizeDateStr(row.date);
      if (byDate[d]) {
        const newCount = row.newFriends;
        byDate[d].partners += 1;
        byDate[d].newFriends += newCount;
        byDate[d].total += 1 + newCount;
      }
    });

    // Group by subC over the period
    const subCMap = {};
    filtered.forEach(row => {
      const subC = row.subC || '未知';
      if (!subCMap[subC]) {
        subCMap[subC] = { partners: 0, newFriends: 0, total: 0, dates: [] };
      }
      const g = subCMap[subC];
      const newCount = row.newFriends;
      g.partners += 1;
      g.newFriends += newCount;
      g.total += 1 + newCount;
    });

    // Trend data: total attendance over time
    const trendLabels = sortedDates.map(d => {
      const parts = d.split('/');
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    });

    const grandTotal = Object.values(byDate).reduce((s, v) => s + v.total, 0);
    const totalPartners = Object.values(byDate).reduce((s, v) => s + v.partners, 0);
    const totalNewFriends = Object.values(byDate).reduce((s, v) => s + v.newFriends, 0);
    const averageAttendance = sortedDates.length > 0
      ? grandTotal / sortedDates.length
      : 0;

    // Growth rate: compare last week to previous week (if enough data)
    let partnerGrowthRate = null;
    let newFriendGrowthRate = null;
    if (sortedDates.length >= 14) {
      const mid = Math.floor(sortedDates.length / 2);
      const firstHalf = sortedDates.slice(0, mid);
      const secondHalf = sortedDates.slice(mid);
      const calc = (dates) => {
        let p = 0, nf = 0;
        dates.forEach(d => { p += byDate[d].partners; nf += byDate[d].newFriends; });
        return { p, nf };
      };
      const h1 = calc(firstHalf);
      const h2 = calc(secondHalf);
      partnerGrowthRate = h1.p > 0 ? ((h2.p - h1.p) / h1.p) * 100 : null;
      newFriendGrowthRate = h1.nf > 0 ? ((h2.nf - h1.nf) / h1.nf) * 100 : null;
    }

    const trendData = {
      labels: trendLabels,
      datasets: [
        {
          label: '總出席',
          data: sortedDates.map(d => byDate[d].total),
        },
        {
          label: '夥伴',
          data: sortedDates.map(d => byDate[d].partners),
        },
        {
          label: '新朋友',
          data: sortedDates.map(d => byDate[d].newFriends),
        },
      ],
      subGroupDatasets: Object.entries(subCMap)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8)
        .map(([name, g]) => ({
          label: name,
          data: sortedDates.map(d => {
            // Per-date count for this subC
            return filtered.filter(r =>
              normalizeDateStr(r.date) === d && r.subC === name
            ).reduce((sum, r) => sum + 1 + r.newFriends, 0);
          }),
        })),
    };

    setCorsHeaders(res);
    return res.status(200).json({
      trendData,
      analysis: {
        grandTotal,
        totalPartners,
        totalNewFriends,
        partnerGrowthRate,
        newFriendGrowthRate,
        averageAttendance,
      },
    });
  } catch (err) {
    console.error('trend API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
