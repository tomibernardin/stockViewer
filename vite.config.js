import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// GET directo sin redirect-follow (Node 16 compatible)
function nodeGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, ...extraHeaders } }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode === 429) return reject(new Error('429 Too Many Requests'))
        try { resolve({ body: JSON.parse(data), status: res.statusCode, headers: res.headers }) }
        catch { resolve({ body: null, raw: data.slice(0, 120), status: res.statusCode, headers: res.headers }) }
      })
    })
    .on('error', reject)
    .setTimeout(12000, function () { this.destroy(); reject(new Error('timeout')) })
  })
}

// Crumb (se cachea junto con la sesión)
let _session = null

async function getSession() {
  if (_session?.expiresAt > Date.now()) return _session
  console.log('\n[yahoo] fetching crumb...')

  const r1 = await nodeGet('https://finance.yahoo.com/')
  const cookies = (r1.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ')

  const r2 = await nodeGet('https://query2.finance.yahoo.com/v1/test/getcrumb', { Cookie: cookies })
  const crumb = r2.raw?.trim() ?? ''
  const valid = crumb.length > 0 && crumb.length < 50 && !crumb.startsWith('<') && !crumb.includes(' ')
  console.log(`[yahoo] crumb: "${crumb.slice(0, 20)}" valid=${valid}`)

  _session = { cookie: cookies, crumb: valid ? crumb : null, expiresAt: Date.now() + 25 * 60 * 1000 }
  return _session
}

// Caché por ticker para no hammear Yahoo en dev (TTL: 5 min)
const _cache = new Map()  // symbol → { data, expiresAt }

function getCached(symbol) {
  const entry = _cache.get(symbol)
  return entry?.expiresAt > Date.now() ? entry.data : null
}

function setCache(symbol, data) {
  _cache.set(symbol, { data, expiresAt: Date.now() + 5 * 60 * 1000 })
}

function apiMiddlewarePlugin() {
  return {
    name: 'api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/quote')) return next()

        const qs     = new URL(req.url, 'http://localhost')
        const symbol = qs.searchParams.get('symbol')?.toUpperCase()
        if (!symbol) { res.statusCode = 400; res.end('{"error":"missing symbol"}'); return }

        // Devolver desde caché si está vigente
        const cached = getCached(symbol)
        if (cached) {
          console.log(`[yahoo] ${symbol} — serving from cache`)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(cached))
          return
        }

        console.log(`[yahoo] ${symbol} — fetching...`)

        try {
          // 1. Chart (no necesita crumb)
          const chartR = await nodeGet(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=1y`
          )
          const price = chartR.body?.chart?.result?.[0]?.meta?.regularMarketPrice
          console.log(`[yahoo] ${symbol} price=${price} chart=${!!chartR.body}`)

          // 2. QuoteSummary con crumb (best effort)
          let summaryBody = null
          try {
            const session = await getSession()
            if (session.crumb) {
              const modules = 'summaryDetail,defaultKeyStatistics,financialData,earnings'
              const sr = await nodeGet(
                `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
                { Cookie: session.cookie }
              )
              summaryBody = sr.body
              console.log(`[yahoo] ${symbol} summary=${!!summaryBody?.quoteSummary?.result?.[0]}`)
            }
          } catch (e) {
            console.warn(`[yahoo] ${symbol} summary error: ${e.message}`)
          }

          const payload = { summary: summaryBody ?? {}, chart: chartR.body ?? {} }
          setCache(symbol, payload)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(payload))

        } catch (e) {
          console.error(`[yahoo] ${symbol} error: ${e.message}`)
          // En 429 devuelve error para que el cliente use fallback
          res.statusCode = e.message.includes('429') ? 429 : 502
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiMiddlewarePlugin()],
})
