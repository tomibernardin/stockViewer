import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── HTTP helper (Node 16, sin deps) ──────────────────────────
function nodeGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, ...extraHeaders } }, res => {
      // Seguir un nivel de redirect
      if ([301, 302, 303].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://finance.yahoo.com${res.headers.location}`
        const redirectCookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0])
        return nodeGet(loc, { ...extraHeaders, ...(redirectCookies.length ? { Cookie: redirectCookies.join('; ') } : {}) })
          .then(r => resolve({ ...r, cookiesFromHop: redirectCookies }))
          .catch(reject)
      }
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0])
        try {
          resolve({ body: JSON.parse(body), raw: null, status: res.statusCode, cookies })
        } catch {
          resolve({ body: null, raw: body.slice(0, 150), status: res.statusCode, cookies })
        }
      })
    })
    .on('error', reject)
    .setTimeout(14000, function () { this.destroy(); reject(new Error('timeout')) })
  })
}

// ── Crumb session (caché en proceso Vite) ────────────────────
let _session = null

async function getSession(forceRefresh = false) {
  if (!forceRefresh && _session?.expiresAt > Date.now()) return _session

  console.log('\n[yahoo] Refreshing crumb session...')

  const r1  = await nodeGet('https://finance.yahoo.com/')
  const allCookies = [...(r1.cookiesFromHop || []), ...(r1.cookies || [])]
  const cookie = allCookies.join('; ')
  console.log('[yahoo] homepage cookies:', allCookies.length, '| status:', r1.status)

  const r2    = await nodeGet('https://query2.finance.yahoo.com/v1/test/getcrumb', { Cookie: cookie })
  const crumb = (r2.raw ?? '').trim()
  const valid  = crumb.length > 0 && crumb.length < 50 && !crumb.includes('<') && !crumb.includes(' ')
  console.log(`[yahoo] crumb: "${crumb.slice(0, 25)}" | valid=${valid} | status=${r2.status}`)

  _session = {
    cookie,
    crumb:     valid ? crumb : null,
    expiresAt: Date.now() + (valid ? 25 : 2) * 60 * 1000,  // reintenta rápido si falla
  }
  return _session
}

// ── Caché de respuestas por ticker ───────────────────────────
// Precio: TTL 45s (semi-real-time). Fundamentales: TTL 5min.
const _priceCache = new Map()    // symbol → { meta, closes, expiresAt }
const _fundCache  = new Map()    // symbol → { summaryBody, expiresAt }

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
            ? _priceCache.get(symbol).data
            : null

          if (!chartBody) {
            console.log(`[yahoo] ${symbol} fetching chart...`)
            const cr = await nodeGet(
              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=1y`
            )
            if (cr.status === 429) throw new Error('429 rate limited')
            chartBody = cr.body
            if (chartBody) _priceCache.set(symbol, { data: chartBody, expiresAt: Date.now() + 45_000 })
            const price = chartBody?.chart?.result?.[0]?.meta?.regularMarketPrice
            console.log(`[yahoo] ${symbol} price=${price} chart_ok=${!!chartBody}`)
          } else {
            console.log(`[yahoo] ${symbol} price from cache`)
          }

          // ── 2. Fundamentales / quoteSummary (caché 5min) ──
          let summaryBody = _fundCache.get(symbol)?.expiresAt > Date.now()
            ? _fundCache.get(symbol).data
            : null

          if (!summaryBody) {
            try {
              const session = await getSession()
              if (session.crumb) {
                const modules = 'summaryDetail,defaultKeyStatistics,financialData,earnings'
                const sr = await nodeGet(
                  `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
                  { Cookie: session.cookie }
                )
                if (sr.status === 401) {
                  console.warn(`[yahoo] ${symbol} crumb expired — refreshing`)
                  await getSession(true)
                } else if (sr.body) {
                  summaryBody = sr.body
                  _fundCache.set(symbol, { data: summaryBody, expiresAt: Date.now() + 5 * 60_000 })
                  const ok = !!summaryBody?.quoteSummary?.result?.[0]
                  console.log(`[yahoo] ${symbol} summary_ok=${ok}`)
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
