import { getAllData, setCorsHeaders, handleOptions, normalizeDateStr, getDateRange } from './sheet.js';

export default async function handler(req, res) {
  handleOptions(req, res);
  if (req.method === 'OPTIONS') return;

  const { period = 'week' } = req.query || {};

  try {
    const data = await getAllData();
    const { start, end, label, prevStart, prevEnd, prevLabel } = getDateRange(period);

    const fmtD = (d) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

    function calcPeriod(s, e) {
      const sN = normalizeDateStr(fmtD(s));
      const eN = normalizeDateStr(fmtD(e));
      const rows = data.filter(r => {
        const d = normalizeDateStr(r.date);
        return d >= sN && d <= eN;
      });
      let grandTotal = 0, totalPartners = 0, totalNewFriends = 0;
      rows.forEach(r => {
        grandTotal += 1 + r.newFriends;
        totalPartners += 1;
        totalNewFriends += r.newFriends;
      });
      return { grandTotal, totalPartners, totalNewFriends };
    }

    const currentPeriod = calcPeriod(start, end);
    const previousPeriod = calcPeriod(prevStart, prevEnd);

    const growthRate = (current, previous) => {
      if (previous === 0) return previous === 0 && current > 0 ? Infinity : null;
      return ((current - previous) / previous) * 100;
    };

    const growthRates = {
      grandTotal: growthRate(currentPeriod.grandTotal, previousPeriod.grandTotal),
      partner: growthRate(currentPeriod.totalPartners, previousPeriod.totalPartners),
      newFriend: growthRate(currentPeriod.totalNewFriends, previousPeriod.totalNewFriends),
    };

    // Add period labels
    currentPeriod.label = label;
    previousPeriod.label = prevLabel;

    setCorsHeaders(res);
    return res.status(200).json({
      currentPeriod,
      previousPeriod,
      growthRates,
    });
  } catch (err) {
    console.error('comparison API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
