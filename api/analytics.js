import { getAllData, setCorsHeaders, handleOptions, normalizeDateStr } from './sheet.js';

export default async function handler(req, res) {
  handleOptions(req, res);
  if (req.method === 'OPTIONS') return;

  const { date } = req.query || {};
  if (!date) {
    return res.status(400).json({ error: 'Missing date parameter' });
  }

  try {
    const data = await getAllData();
    const normalizedDate = normalizeDateStr(date);

    // Filter rows for this date
    const rows = data.filter(row => normalizeDateStr(row.date) === normalizedDate);

    if (rows.length === 0) {
      return res.status(200).json({
        date,
        grandTotal: 0,
        totalPartners: 0,
        totalNewFriends: 0,
        subGroupData: [],
      });
    }

    // Group by subC
    const subCMap = {};
    rows.forEach(row => {
      const subC = row.subC || '未知';
      if (!subCMap[subC]) {
        subCMap[subC] = {
          name: subC,
          partners: 0,
          newFriends: 0,
          total: 0,
          attendees: [],
        };
      }
      const group = subCMap[subC];
      const newCount = row.newFriends;

      if (newCount > 0) {
        // This partner brought new friends
        group.partners += 1;
        group.newFriends += newCount;
        group.total += 1 + newCount;
        group.attendees.push({ name: row.name, type: 'partner' });
        for (let i = 0; i < newCount; i++) {
          group.attendees.push({ name: `新朋友${i + 1}`, type: 'friend' });
        }
      } else {
        group.partners += 1;
        group.total += 1;
        group.attendees.push({ name: row.name, type: 'partner' });
      }
    });

    const subGroupData = Object.values(subCMap);

    const grandTotal = subGroupData.reduce((sum, g) => sum + g.total, 0);
    const totalPartners = subGroupData.reduce((sum, g) => sum + g.partners, 0);
    const totalNewFriends = subGroupData.reduce((sum, g) => sum + g.newFriends, 0);

    setCorsHeaders(res);
    return res.status(200).json({
      date,
      grandTotal,
      totalPartners,
      totalNewFriends,
      subGroupData,
    });
  } catch (err) {
    console.error('analytics API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
