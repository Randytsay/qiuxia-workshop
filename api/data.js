export default async function handler(req, res) {
  const SHEET_ID = '1QEytkFQTYVgkwCxgcC4BKrvf9ZkC_GApJd1U6JQAnsI'
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const response = await fetch(CSV_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WorkshopDashboard/1.0)',
      }
    })

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch CSV', status: response.status })
    }

    const text = await response.text()

    const parseCSVLine = (line) => {
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

    const lines = text.trim().replace(/\r\n?/g, '\n').split('\n')
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/\r/g, ''))
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length >= headers.length) {
        const row = {}
        headers.forEach((h, idx) => {
          row[h] = (values[idx] || '').trim().replace(/^"|"$/g, '').replace(/\r$/, '')
        })
        rows.push(row)
      }
    }

    return res.status(200).json({ data: rows, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error('API error:', err)
    return res.status(500).json({ error: err.message })
  }
}
