export default async function handler(req, res) {
  const SHEET_ID = '1QEytkFQTYVgkwCxgcC4BKrvf9ZkC_GApJd1U6JQAnsI'
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`

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

    // Parse CSV
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

    const lines = text.trim().split('\n')
    const headers = parseCSVLine(lines[0])
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length >= headers.length) {
        const row = {}
        headers.forEach((h, idx) => {
          row[h] = (values[idx] || '').trim().replace(/^"|"$/g, '')
        })
        rows.push(row)
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')
    res.status(200).json({ data: rows, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error('API error:', err)
    res.status(500).json({ error: err.message })
  }
}
