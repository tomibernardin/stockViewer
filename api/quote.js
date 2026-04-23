// ============================================================
// api/quote.js — Vercel Serverless Function
// Proxy a Yahoo Finance con autenticación crumb.
// Runtime: Node 18 (Vercel default) — usa native fetch.
//
// Flujo:
//   1. GET finance.yahoo.com → obtener cookies de sesión
//   2. GET /v1/test/getcrumb con esas cookies → crumb token
//   3. GET chart (precio/historial) — no requiere crumb
//   4. GET quoteSummary (fundamentales) — requiere crumb
//
// El crumb se cachea en memoria mientras la instancia está caliente
// (Vercel reutiliza instancias ~10 min). TTL: 25 min.
// ============================================================

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Caché en memoria (warm instance)
let _session   = null
const _fundCache = new Map()
const _priceCache = new Map()

async function getSession(forceRefresh = false) {
  if (!forceRefresh && _session?.expiresAt > Date.now()) return _session

  const r1 = await fetch('https://finance.yahoo.com/', {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  })
  // Node 18: getSetCookie() devuelve array de strings
  const rawCookies = r1.headers.getSetCookie?.() ?? []
  const cookie = rawCookies.join('; ')

  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
  })
  const crumb = (await r2.text()).trim()
  const valid  = crumb.length > 0 && crumb.length < 50 && !crumb.includes('<') && !crumb.includes(' ')

  _session = {
    cookie,
    crumb:     valid ? crumb : null,
    expiresAt: Date.now() + (valid ? 25 : 2) * 60 * 1000,
  }
  return _session
}

export default async function handler(req, res) {
  const { symbol } = req.query
  if (!symbol) {
    res.status(400).json({ error: 'symbol is required' })
    return
  }

  const ticker = symbol.toUpperCase()

  try {
    const headers = { 'User-Agent': UA }

    // ── Chart (caché 45s) ────────────────────────────────────
    let chartBody = _priceCache.get(ticker)?.expiresAt > Date.now()
      ? _priceCache.get(ticker).data
      : null

    if (!chartBody) {
      const cr = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=1y`,
        { headers }
      )
      chartBody = cr.ok ? await cr.json() : null
      if (chartBody) _priceCache.set(ticker, { data: chartBody, expiresAt: Date.now() + 45_000 })
    }

    // ── QuoteSummary con crumb (caché 5min) ──────────────────
    let summaryBody = _fundCache.get(ticker)?.expiresAt > Date.now()
      ? _fundCache.get(ticker).data
      : null

    if (!summaryBody) {
      try {
        let session = await getSession()
        if (session.crumb) {
          const modules = 'summaryDetail,defaultKeyStatistics,financialData,earnings'
          const sr = await fetch(
            `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
            { headers: { ...headers, Cookie: session.cookie } }
          )
          if (sr.status === 401) {
            session = await getSession(true)  // renovar crumb
          } else if (sr.ok) {
            summaryBody = await sr.json()
            if (summaryBody?.quoteSummary?.result?.[0]) {
              _fundCache.set(ticker, { data: summaryBody, expiresAt: Date.now() + 5 * 60_000 })
            }
          }
        }
      } catch { /* fundamentales son best-effort */ }
    }

    // Cache-Control: 40s para que Vercel CDN no sirva precios viejos
    res.setHeader('Cache-Control', 's-maxage=40, stale-while-revalidate=20')
    res.status(200).json({ summary: summaryBody ?? {}, chart: chartBody ?? {} })
  } catch (err) {
    res.status(502).json({ error: 'upstream failed', detail: err.message })
  }
}
