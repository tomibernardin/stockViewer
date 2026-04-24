import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const EXTRA_HEADERS = { 'Accept': 'application/json, text/html,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' }

// ── Mapeo BYMA → ticker subyacente US (espejo de api/quote.js) ─
const FUND_MAP = {
  YPFD: 'YPF',
  PAMP: 'PAM',
}

// ── HTTP helper (Node 16+, sin deps) ─────────────────────────
function nodeGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, ...EXTRA_HEADERS, ...extraHeaders } }, res => {
      if ([301, 302, 303].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location : `https://finance.yahoo.com${res.headers.location}`
        const hopCookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0].trim())
        return nodeGet(loc, { ...extraHeaders, ...(hopCookies.length ? { Cookie: hopCookies.join('; ') } : {}) })
          .then(r => resolve({ ...r, cookiesFromHop: [...hopCookies, ...(r.cookiesFromHop || [])] }))
          .catch(reject)
      }
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0].trim())
        try   { resolve({ body: JSON.parse(body), raw: null, status: res.statusCode, cookies }) }
        catch { resolve({ body: null, raw: body.slice(0, 300), status: res.statusCode, cookies }) }
      })
    })
    .on('error', reject)
    .setTimeout(14_000, function () { this.destroy(); reject(new Error('timeout')) })
  })
}

// ── Helpers de formato (espejo de api/quote.js) ──────────────
function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return null
  return parseFloat(n.toFixed(d))
}
function fmtBig(n) {
  if (n == null || isNaN(n)) return null
  const abs = Math.abs(n)
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9)  return (n / 1e9).toFixed(2)  + 'B'
  if (abs >= 1e6)  return (n / 1e6).toFixed(2)  + 'M'
  return n.toLocaleString()
}
function isValidCrumb(s) {
  return typeof s === 'string' && s.length > 0 && s.length < 50 &&
    !s.includes('<') && !s.includes(' ') && !s.toLowerCase().includes('too many')
}

// ── Crumb session ────────────────────────────────────────────
let _session = null

async function tryCrumb(originUrl) {
  const r1 = await nodeGet(originUrl)
  const allCookies = [...(r1.cookiesFromHop || []), ...(r1.cookies || [])]
  if (!allCookies.length) return null
  const cookie = allCookies.join('; ')
  const r2 = await nodeGet('https://query2.finance.yahoo.com/v1/test/getcrumb', { Cookie: cookie })
  const text = (r2.raw ?? '').trim()
  return isValidCrumb(text) ? { cookie, crumb: text } : null
}
async function getSession(forceRefresh = false) {
  if (!forceRefresh && _session?.expiresAt > Date.now()) return _session
  console.log('\n[yahoo] Refreshing crumb session...')
  let result = null
  try { result = await tryCrumb('https://fc.yahoo.com'); if (result) console.log(`[yahoo] crumb via fc.yahoo.com`) }
  catch (e) { console.warn('[yahoo] fc.yahoo.com:', e.message) }
  if (!result) {
    try { result = await tryCrumb('https://finance.yahoo.com/'); if (result) console.log(`[yahoo] crumb via finance.yahoo.com`) }
    catch (e) { console.warn('[yahoo] finance.yahoo.com:', e.message) }
  }
  if (!result) console.warn('[yahoo] crumb unavailable')
  _session = result
    ? { ...result, expiresAt: Date.now() + 25 * 60_000 }
    : { cookie: '', crumb: null, expiresAt: Date.now() + 2 * 60_000 }
  return _session
}

// ── Normalizadores (espejo de api/quote.js) ──────────────────
function normalizeYahoo(meta, sd, ks, fd, earn, closes, hasFund) {
  const chartPrices = (closes ?? []).filter(Boolean).map(v => parseFloat(v.toFixed(2)))
  return {
    price:     fmt(meta.regularMarketPrice ?? sd.regularMarketPrice?.raw),
    change:    fmt(meta.regularMarketChange ?? sd.regularMarketChange?.raw),
    changePct: fmt(
      meta.regularMarketChangePercent != null ? meta.regularMarketChangePercent * 100 :
      sd.regularMarketChangePercent?.raw  != null ? sd.regularMarketChangePercent.raw * 100 : null
    ),
    volume:    fmtBig(meta.regularMarketVolume ?? sd.regularMarketVolume?.raw),
    marketCap: fmtBig(meta.marketCap ?? sd.marketCap?.raw),
    week52High: fmt(meta.fiftyTwoWeekHigh ?? sd.fiftyTwoWeekHigh?.raw),
    week52Low:  fmt(meta.fiftyTwoWeekLow  ?? sd.fiftyTwoWeekLow?.raw),
    pe:        hasFund ? fmt(sd.trailingPE?.raw) : null,
    pb:        hasFund ? fmt(sd.priceToBook?.raw ?? ks.priceToBook?.raw) : null,
    ps:        hasFund ? fmt(ks.priceToSalesTrailing12Months?.raw) : null,
    evEbitda:  hasFund ? fmt(ks.enterpriseToEbitda?.raw) : null,
    debtEq:    hasFund ? fmt(fd.debtToEquity?.raw) : null,
    currentRatio: hasFund ? fmt(fd.currentRatio?.raw) : null,
    interestCov:  null,
    freeCashFlow: hasFund ? fmtBig(fd.freeCashflow?.raw) : null,
    revenueGrowth:  hasFund && fd.revenueGrowth?.raw  != null ? fmt(fd.revenueGrowth.raw  * 100) : null,
    epsGrowth:      hasFund && fd.earningsGrowth?.raw != null ? fmt(fd.earningsGrowth.raw * 100) : null,
    marginTrend:    hasFund && fd.grossMargins?.raw   != null ? fmt(fd.grossMargins.raw   * 100) : null,
    returnOnEquity: hasFund && fd.returnOnEquity?.raw != null ? fmt(fd.returnOnEquity.raw * 100) : null,
    chartPrices: chartPrices.length >= 3 ? chartPrices : null,
    quarterlyData: earn.length ? earn.slice(-4).map(q => ({
      quarter: q.date, revenue: fmtBig(q.revenue?.raw), eps: fmt(q.earnings?.raw),
      netIncome: '—', margin: null, epsStatus: (q.earnings?.raw ?? 0) > 0 ? 'beats' : 'misses',
    })) : null,
    currency: 'ARS',
    source: hasFund ? 'byma_full' : 'byma_price',
  }
}

function finnhubFundamentals(m) {
  return {
    pe:        fmt(m.peBasicExclExtraTTM ?? m.peTTM),
    pb:        fmt(m.pbAnnual ?? m.pbQuarterly),
    ps:        fmt(m.psAnnual ?? m.psTTM),
    evEbitda:  fmt(m.evEbitdaTTM ?? m.evEbitdaAnnual),
    debtEq:    fmt(m['totalDebt/totalEquityAnnual'] ?? m['totalDebt/totalEquityQuarterly']),
    currentRatio:   fmt(m.currentRatioAnnual ?? m.currentRatioQuarterly),
    interestCov:    null,
    freeCashFlow:   m.freeCashFlowAnnual ? fmtBig(m.freeCashFlowAnnual * 1e6) : null,
    revenueGrowth:  m.revenueGrowthTTMYoy != null ? fmt(m.revenueGrowthTTMYoy * 100) : null,
    epsGrowth:      null,
    marginTrend:    fmt(m.grossMarginTTM ?? m.grossMarginAnnual),
    returnOnEquity: fmt(m.roeTTM ?? m.roeAnnual),
    week52High: fmt(m['52WeekHigh']),
    week52Low:  fmt(m['52WeekLow']),
  }
}

function mergeBymaFinnhub(bymaBase, m) {
  return {
    ...bymaBase,
    ...finnhubFundamentals(m),
    week52High: bymaBase.week52High ?? fmt(m['52WeekHigh']),
    week52Low:  bymaBase.week52Low  ?? fmt(m['52WeekLow']),
    currency: 'ARS',
    source: 'byma+finnhub',
  }
}

// ── Caché ────────────────────────────────────────────────────
const _priceCache = new Map()
const _fundCache  = new Map()
const _fhCache    = new Map()

// ── Plugin Vite ──────────────────────────────────────────────
function apiMiddlewarePlugin() {
  return {
    name: 'api-middleware',
    configureServer(server) {
      getSession().catch(e => console.warn('[yahoo] warm-up error:', e.message))

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/quote')) return next()

        const ticker = new URL(req.url, 'http://localhost').searchParams.get('symbol')?.toUpperCase()
        if (!ticker) { res.statusCode = 400; res.end('{"error":"missing symbol"}'); return }

        const baSymbol   = `${ticker}.BA`
        const fundTicker = FUND_MAP[ticker] ?? ticker
        const FINNHUB_KEY = process.env.FINNHUB_API_KEY || ''

        try {
          // ── 1. Yahoo chart desde BYMA (.BA) ──────────────────
          let chartBody = _priceCache.get(baSymbol)?.expiresAt > Date.now()
            ? _priceCache.get(baSymbol).data : null
          if (!chartBody) {
            console.log(`[byma] ${baSymbol} fetching chart...`)
            const cr = await nodeGet(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(baSymbol)}?interval=1mo&range=1y`)
            if (cr.status === 429) throw new Error('429 rate limited')
            chartBody = cr.body
            if (chartBody?.chart?.result?.[0]) {
              _priceCache.set(baSymbol, { data: chartBody, expiresAt: Date.now() + 45_000 })
              console.log(`[byma] ${baSymbol} price=${chartBody.chart.result[0].meta?.regularMarketPrice} ARS`)
            }
          } else {
            console.log(`[byma] ${baSymbol} price (cache)`)
          }

          const chartResult  = chartBody?.chart?.result?.[0]
          const meta         = chartResult?.meta ?? {}
          const closes       = chartResult?.indicators?.quote?.[0]?.close ?? []
          const bymaHasPrice = !!meta.regularMarketPrice

          // ── 2. Yahoo quoteSummary desde ticker subyacente US ─
          let summaryResult = _fundCache.get(fundTicker)?.expiresAt > Date.now()
            ? _fundCache.get(fundTicker).data : null
          if (!summaryResult && bymaHasPrice) {
            try {
              let session = await getSession()
              if (session.crumb) {
                const modules = 'summaryDetail,defaultKeyStatistics,financialData,earnings'
                const sr = await nodeGet(
                  `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(fundTicker)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
                  { Cookie: session.cookie }
                )
                if (sr.status === 401) {
                  console.warn(`[yahoo] ${fundTicker} crumb expired — refreshing`)
                  await getSession(true)
                } else if (sr.body?.quoteSummary?.result?.[0]) {
                  summaryResult = sr.body.quoteSummary.result[0]
                  _fundCache.set(fundTicker, { data: summaryResult, expiresAt: Date.now() + 5 * 60_000 })
                  console.log(`[yahoo] ${fundTicker} summary ok`)
                }
              }
            } catch (e) { console.warn(`[yahoo] ${fundTicker} summary: ${e.message}`) }
          }

          const sd   = summaryResult?.summaryDetail        ?? {}
          const ks   = summaryResult?.defaultKeyStatistics ?? {}
          const fd   = summaryResult?.financialData        ?? {}
          const earn = summaryResult?.earnings?.financialsChart?.quarterly ?? []
          const hasFund = !!summaryResult

          // ── 3. Decisión de fuente ───────────────────────────
          let payload

          if (bymaHasPrice && hasFund) {
            payload = normalizeYahoo(meta, sd, ks, fd, earn, closes, true)

          } else if (bymaHasPrice && !hasFund && FINNHUB_KEY) {
            let fhData = _fhCache.get(fundTicker)?.expiresAt > Date.now() ? _fhCache.get(fundTicker).data : null
            if (!fhData) {
              console.log(`[finnhub] ${fundTicker} fetching metrics...`)
              const [mRes, pRes] = await Promise.all([
                nodeGet(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(fundTicker)}&metric=all&token=${FINNHUB_KEY}`),
                nodeGet(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(fundTicker)}&token=${FINNHUB_KEY}`),
              ])
              fhData = { m: mRes.body?.metric ?? {}, p: pRes.body ?? {} }
              _fhCache.set(fundTicker, { data: fhData, expiresAt: Date.now() + 60_000 })
              console.log(`[finnhub] ${fundTicker} metrics ok`)
            }
            const bymaBase = normalizeYahoo(meta, {}, {}, {}, [], closes, false)
            payload = mergeBymaFinnhub(bymaBase, fhData.m)

          } else if (bymaHasPrice) {
            payload = normalizeYahoo(meta, sd, ks, fd, earn, closes, false)

          } else {
            throw new Error('no BYMA data available')
          }

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(payload))
        } catch (e) {
          console.error(`[proxy] ${ticker} FATAL: ${e.message}`)
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
