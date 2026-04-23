import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const EXTRA_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

// ── HTTP helper (Node 16+, sin deps) ─────────────────────────
// Devuelve { body, raw, status, cookies, cookiesFromHop }
function nodeGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, ...EXTRA_HEADERS, ...extraHeaders } }, res => {
      // Seguir un nivel de redirect
      if ([301, 302, 303].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://finance.yahoo.com${res.headers.location}`
        const hopCookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0].trim())
        return nodeGet(loc, { ...extraHeaders, ...(hopCookies.length ? { Cookie: hopCookies.join('; ') } : {}) })
          .then(r => resolve({ ...r, cookiesFromHop: [...hopCookies, ...(r.cookiesFromHop || [])] }))
          .catch(reject)
      }
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0].trim())
        try {
          resolve({ body: JSON.parse(body), raw: null, status: res.statusCode, cookies })
        } catch {
          resolve({ body: null, raw: body.slice(0, 200), status: res.statusCode, cookies })
        }
      })
    })
    .on('error', reject)
    .setTimeout(14_000, function () { this.destroy(); reject(new Error('timeout')) })
  })
}

// ── Valida que el string sea un crumb real ───────────────────
function isValidCrumb(s) {
  return typeof s === 'string' && s.length > 0 && s.length < 50 &&
         !s.includes('<') && !s.includes(' ') && !s.toLowerCase().includes('too many')
}

// ── Intenta crumb desde una URL origen ──────────────────────
async function tryCrumb(originUrl) {
  const r1 = await nodeGet(originUrl)
  const allCookies = [...(r1.cookiesFromHop || []), ...(r1.cookies || [])]
  if (!allCookies.length) return null
  const cookie = allCookies.join('; ')

  const r2 = await nodeGet('https://query2.finance.yahoo.com/v1/test/getcrumb', { Cookie: cookie })
  const text = (r2.raw ?? '').trim()
  return isValidCrumb(text) ? { cookie, crumb: text } : null
}

// ── Sesión (crumb + cookie), cached 25 min ───────────────────
let _session = null

async function getSession(forceRefresh = false) {
  if (!forceRefresh && _session?.expiresAt > Date.now()) return _session

  console.log('\n[yahoo] Refreshing crumb session...')

  let result = null

  // 1️⃣  fc.yahoo.com (GDPR consent — más fiable desde IPs de servidor)
  try {
    result = await tryCrumb('https://fc.yahoo.com')
    if (result) console.log(`[yahoo] crumb via fc.yahoo.com: "${result.crumb.slice(0, 20)}"`)
  } catch (e) {
    console.warn('[yahoo] fc.yahoo.com failed:', e.message)
  }

  // 2️⃣  Fallback: finance.yahoo.com
  if (!result) {
    try {
      result = await tryCrumb('https://finance.yahoo.com/')
      if (result) console.log(`[yahoo] crumb via finance.yahoo.com: "${result.crumb.slice(0, 20)}"`)
    } catch (e) {
      console.warn('[yahoo] finance.yahoo.com fallback failed:', e.message)
    }
  }

  if (!result) console.warn('[yahoo] crumb unavailable — fundamentals will use fallback data')

  _session = result
    ? { ...result, expiresAt: Date.now() + 25 * 60_000 }
    : { cookie: '', crumb: null, expiresAt: Date.now() + 2 * 60_000 }

  return _session
}

// ── Caché de respuestas por ticker ───────────────────────────
const _priceCache = new Map()   // symbol → { data, expiresAt }
const _fundCache  = new Map()   // symbol → { data, expiresAt }

// ── Plugin Vite ──────────────────────────────────────────────
function apiMiddlewarePlugin() {
  return {
    name: 'api-middleware',
    configureServer(server) {
      // Pre-calentamos el crumb en background al iniciar
      getSession().catch(e => console.warn('[yahoo] warm-up error:', e.message))

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/quote')) return next()

        const qs     = new URL(req.url, 'http://localhost')
        const symbol = qs.searchParams.get('symbol')?.toUpperCase()
        if (!symbol) { res.statusCode = 400; res.end('{"error":"missing symbol"}'); return }

        try {
          // ── 1. Chart / precio (caché 45s) ──────────────────
          let chartBody = _priceCache.get(symbol)?.expiresAt > Date.now()
            ? _priceCache.get(symbol).data : null

          if (!chartBody) {
            console.log(`[yahoo] ${symbol} fetching chart...`)
            const cr = await nodeGet(
              `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=1y`
            )
            if (cr.status === 429) throw new Error('429 rate limited')
            chartBody = cr.body
            if (chartBody?.chart?.result?.[0]) {
              _priceCache.set(symbol, { data: chartBody, expiresAt: Date.now() + 45_000 })
              const price = chartBody.chart.result[0].meta?.regularMarketPrice
              console.log(`[yahoo] ${symbol} price=${price}`)
            } else {
              console.warn(`[yahoo] ${symbol} chart returned no data (status=${cr.status})`)
            }
          } else {
            console.log(`[yahoo] ${symbol} price from cache`)
          }

          // ── 2. Fundamentales / quoteSummary (caché 5 min) ──
          let summaryBody = _fundCache.get(symbol)?.expiresAt > Date.now()
            ? _fundCache.get(symbol).data : null

          if (!summaryBody) {
            try {
              let session = await getSession()
              if (session.crumb) {
                const modules = 'summaryDetail,defaultKeyStatistics,financialData,earnings'
                const sr = await nodeGet(
                  `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
                  `?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
                  { Cookie: session.cookie }
                )
                if (sr.status === 401) {
                  console.warn(`[yahoo] ${symbol} crumb expired — refreshing`)
                  session = await getSession(true)
                  // reintento tras refresh (next request lo captará desde caché)
                } else if (sr.body?.quoteSummary?.result?.[0]) {
                  summaryBody = sr.body
                  _fundCache.set(symbol, { data: summaryBody, expiresAt: Date.now() + 5 * 60_000 })
                  console.log(`[yahoo] ${symbol} summary ok`)
                } else {
                  console.warn(`[yahoo] ${symbol} summary empty (status=${sr.status})`)
                }
              }
            } catch (e) {
              console.warn(`[yahoo] ${symbol} summary error: ${e.message}`)
            }
          }

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify({ summary: summaryBody ?? {}, chart: chartBody ?? {} }))
        } catch (e) {
          console.error(`[yahoo] ${symbol} FATAL: ${e.message}`)
          const code = e.message.includes('429') ? 429 : 502
          res.statusCode = code
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiMiddlewarePlugin()],
})
