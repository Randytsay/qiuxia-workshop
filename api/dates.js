import { getAllData, setCorsHeaders, handleOptions } from './sheet.js';

export default async function handler(req, res) {
  handleOptions(req, res);
  if (req.method === 'OPTIONS') return;

  try {
    const data = await getAllData();
    // Normalize dates and get unique ones, sorted descending
    const dateMap = {};
    data.forEach(row => {
      // Normalize date format
      const parts = row.date.split('/');
      if (parts.length === 3) {
        const [y, mo, day] = parts;
        const key = `${y}/${String(mo).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
        dateMap[key] = true;
      }
    });

    const dates = Object.keys(dateMap).sort((a, b) => new Date(b) - new Date(a));

    setCorsHeaders(res);
    return res.status(200).json({ dates });
  } catch (err) {
    console.error('dates API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
