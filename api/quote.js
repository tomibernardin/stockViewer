// Vercel serverless function — proxy a Yahoo Finance con crumb auth.
// Node 18 runtime (Vercel default) — usa native fetch + getSetCookie().
//
// Yahoo Finance requiere un "crumb" token que se obtiene:
// 1. GET finance.yahoo.com → cookies
// 2. GET /v1/test/getcrumb con esas cookies → crumb string
// 3. Usar crumb como query param en llamadas a quoteSummary
//
// El crumb se cachea en memoria: vive mientras la instancia esté caliente
// (Vercel reutiliza instancias durante ~10 min).

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

let _session = null

async function getSession() {
  // Reusar si fue obtenido en los últimos 25 minutos
  if (_session && _session.expiresAt > Date.now()) return _session

  const r1 = await fetch('https://finance.yahoo.com/', {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  })
  // getSetCookie() disponible en Node 18+
  const rawCookies = r1.headers.getSetCookie?.() ?? []
  const cookie = rawCookies.join('; ')

  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
  })
  const crumb = (await r2.text()).trim()

  _session = { cookie, crumb, expiresAt: Date.now() + 25 * 60 * 1000 }
  return _session
}

export default async function handler(req, res) {
  const { symbol } = req.query
  if (!symbol) {
    res.status(400).json({ error: 'symbol is required' })
    return
  }

  try {
    const ticker  = symbol.toUpperCase()
    const session = await getSession()
    const headers = { 'User-Agent': UA, Cookie: session.cookie }
    const modules = 'summaryDetail,defaultKeyStatistics,financialData,earnings'

    const [summaryRes, chartRes] = await Promise.all([
      fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
        { headers }
      ),
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=1y&crumb=${encodeURIComponent(session.crumb)}`,
        { headers }
      ),
    ])

    const [summary, chart] = await Promise.all([summaryRes.json(), chartRes.json()])

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json({ summary, chart })
  } catch (err) {
    res.status(502).json({ error: 'upstream fetch failed', detail: err.message })
  }
}
