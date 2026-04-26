// Shared Google Sheets CSV fetcher for Vercel Serverless Functions

const SHEET_ID = '1NvM2cZEeLWScclaoO6Lf0JpSNuaBhxms9P4UdZSPJSk';
const SHEET_GID = '827982961'; // 表單回應 1
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

// Column headers (as they appear in the CSV)
const COL = {
  TIMESTAMP: 0,
  DATE: 1,
  NAME: 2,
  SUBC: 3,
  NEW_FRIENDS: 4,
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.trim().replace(/\r\n?/g, '\n').split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length && values[COL.DATE]) {
      const row = {
        date: values[COL.DATE].replace(/"/g, '').trim(),
        name: (values[COL.NAME] || '').replace(/"/g, '').trim(),
        subC: (values[COL.SUBC] || '').replace(/"/g, '').trim(),
        newFriends: parseInt((values[COL.NEW_FRIENDS] || '0').replace(/"/g, '').trim(), 10) || 0,
      };
      // Skip header row
      if (row.date && row.date !== '簽到日期：' && row.name && row.name !== '夥伴姓名：') {
        rows.push(row);
      }
    }
  }
  return rows;
}

let cachedData = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getAllData() {
  const now = Date.now();
  if (cachedData && now - cacheTime < CACHE_TTL) {
    return cachedData;
  }

  const response = await fetch(CSV_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; QiuxiaWorkshop/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status}`);
  }

  const text = await response.text();
  cachedData = parseCSV(text);
  cacheTime = now;
  return cachedData;
}

// Normalize subC name (handle both 半形 and 全形 C)
export function normalizeSubC(name) {
  if (!name) return name;
  return name.replace(/C/g, 'Ｃ').replace(/c/g, 'Ｃ');
}

// Get date range for a period string
export function getDateRange(period) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  let start, end, label, prevStart, prevEnd, prevLabel;

  switch (period) {
    case 'week':
      // Current week (Mon–Sun)
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start = new Date(today);
      start.setDate(today.getDate() + mondayOffset);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      // Previous week
      prevStart = new Date(start);
      prevStart.setDate(start.getDate() - 7);
      prevEnd = new Date(start);
      prevEnd.setDate(start.getDate() - 1);
      label = formatDate(start) + ' ~ ' + formatDate(end);
      prevLabel = formatDate(prevStart) + ' ~ ' + formatDate(prevEnd);
      break;

    case 'month':
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0);
      prevStart = new Date(y, m - 1, 1);
      prevEnd = new Date(y, m, 0);
      label = `${y}年${m + 1}月`;
      prevLabel = `${y}年${m}月`;
      break;

    case 'quarter':
      const q = Math.floor(m / 3);
      start = new Date(y, q * 3, 1);
      end = new Date(y, q * 3 + 3, 0);
      const pq = q === 0 ? 3 : q - 1;
      const py = q === 0 ? y - 1 : y;
      prevStart = new Date(py, pq * 3, 1);
      prevEnd = new Date(py, pq * 3 + 3, 0);
      label = `${y}年Q${q + 1}`;
      prevLabel = `${py}年Q${pq + 1}`;
      break;

    case 'half':
      const h = m < 6 ? 0 : 1;
      start = new Date(y, h * 6, 1);
      end = new Date(y, h * 6 + 6, 0);
      const ph = h === 0 ? 1 : 0;
      const py2 = h === 0 ? y - 1 : y;
      prevStart = new Date(py2, ph * 6, 1);
      prevEnd = new Date(py2, ph * 6 + 6, 0);
      label = `${y}年${h === 0 ? '上半年' : '下半年'}`;
      prevLabel = `${py2}年${ph === 0 ? '上半年' : '下半年'}`;
      break;

    case 'year':
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31);
      prevStart = new Date(y - 1, 0, 1);
      prevEnd = new Date(y - 1, 11, 31);
      label = `${y}年`;
      prevLabel = `${y - 1}年`;
      break;

    default:
      throw new Error('Unknown period: ' + period);
  }

  return { start, end, label, prevStart, prevEnd, prevLabel };
}

export function formatDate(d) {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function normalizeDateStr(dateStr) {
  // Convert "2023/1/5" → "2023/01/05" for consistent comparison
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return dateStr.trim();
  const [y, mo, day] = parts;
  return `${y}/${String(mo).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

// CORS headers
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
}

export function handleOptions(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
}
