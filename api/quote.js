// ============================================================
// api/quote.js — Vercel Serverless Function
// Proxy a Yahoo Finance con autenticación crumb.
// Runtime: Node 18 (Vercel default) — usa native fetch.
//
// Flujo de cookies (2025):
//   1. GET fc.yahoo.com (consent endpoint) → cookies de sesión  [primario]
//   2. Fallback: GET finance.yahoo.com → cookies de sesión
//   3. GET query2 /v1/test/getcrumb con esas cookies → crumb
//   4. GET chart  (query2, sin crumb)  → precio / historial
//   5. GET quoteSummary (query2, con crumb) → fundamentales
//
// Caché en memoria (instancia caliente, ~10 min en Vercel):
//   crumb/cookie: TTL 25 min | price: TTL 45s | fundamentals: TTL 5 min
// ============================================================

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const HEADERS_BASE = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
}

// ── Caché en memoria (warm instance) ────────────────────────
let _session    = null
const _fundCache  = new Map()
const _priceCache = new Map()

// ── Extrae cookies de Set-Cookie headers (Node 18) ──────────
function extractCookies(response) {
  return (response.headers.getSetCookie?.() ?? [])
    .map(c => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

// ── Valida que el string sea un crumb real ───────────────────
function isValidCrumb(s) {
  return typeof s === 'string' && s.length > 0 && s.length < 50 &&
         !s.includes('<') && !s.includes(' ') && !s.toLowerCase().includes('too many')
}

// ── Intenta obtener crumb desde una URL de origen de cookies ─
async function tryCrumb(originUrl) {
  const r1 = await fetch(originUrl, {
    headers: HEADERS_BASE,
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  })
  const cookie = extractCookies(r1)
  if (!cookie) return null

  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { ...HEADERS_BASE, Cookie: cookie },
    signal: AbortSignal.timeout(8_000),
  })
  const text = (await r2.text()).trim()
  return isValidCrumb(text) ? { cookie, crumb: text } : null
}

// ── Sesión (crumb + cookie), cached 25 min ───────────────────
async function getSession(forceRefresh = false) {
  if (!forceRefresh && _session?.expiresAt > Date.now()) return _session

  let result = null

  // 1️⃣  fc.yahoo.com — más fiable desde IPs de datacenter (GDPR consent)
  try { result = await tryCrumb('https://fc.yahoo.com') } catch (_) {}

  // 2️⃣  Fallback: finance.yahoo.com
  if (!result) {
    try { result = await tryCrumb('https://finance.yahoo.com') } catch (_) {}
  }

  _session = result
    ? { ...result, expiresAt: Date.now() + 25 * 60_000 }
    : { cookie: '', crumb: null, expiresAt: Date.now() + 2 * 60_000 }

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
    // ── Chart / precio (caché 45s) ───────────────────────────
    let chartBody = _priceCache.get(ticker)?.expiresAt > Date.now()
      ? _priceCache.get(ticker).data : null

    if (!chartBody) {
      const cr = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=1y`,
        { headers: HEADERS_BASE, signal: AbortSignal.timeout(10_000) }
      )
      if (cr.status === 429) throw new Error('429 rate limited')
      chartBody = cr.ok ? await cr.json() : null
      if (chartBody?.chart?.result?.[0]) {
        _priceCache.set(ticker, { data: chartBody, expiresAt: Date.now() + 45_000 })
      }
    }

    // ── QuoteSummary / fundamentales (caché 5 min) ───────────
    let summaryBody = _fundCache.get(ticker)?.expiresAt > Date.now()
      ? _fundCache.get(ticker).data : null

    if (!summaryBody) {
      try {
        let session = await getSession()
        if (session.crumb) {
          const modules = 'summaryDetail,defaultKeyStatistics,financialData,earnings'
          const sr = await fetch(
            `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
            `?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
            {
              headers: { ...HEADERS_BASE, Cookie: session.cookie },
              signal: AbortSignal.timeout(10_000),
            }
          )
          if (sr.status === 401) {
            // crumb expirado → refrescar y reintentar una vez
            session = await getSession(true)
            if (session.crumb) {
              const sr2 = await fetch(
                `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
                `?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
                { headers: { ...HEADERS_BASE, Cookie: session.cookie }, signal: AbortSignal.timeout(10_000) }
              )
              if (sr2.ok) {
                summaryBody = await sr2.json()
              }
            }
          } else if (sr.ok) {
            summaryBody = await sr.json()
          }

          if (summaryBody?.quoteSummary?.result?.[0]) {
            _fundCache.set(ticker, { data: summaryBody, expiresAt: Date.now() + 5 * 60_000 })
          } else {
            summaryBody = null  // descartamos respuestas vacías
          }
        }
      } catch { /* fundamentales son best-effort */ }
    }

    res.setHeader('Cache-Control', 's-maxage=40, stale-while-revalidate=20')
    res.status(200).json({ summary: summaryBody ?? {}, chart: chartBody ?? {} })
  } catch (err) {
    const code = err.message.includes('429') ? 429 : 502
    res.status(code).json({ error: 'upstream failed', detail: err.message })
  }
}
