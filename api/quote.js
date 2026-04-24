// ============================================================
// api/quote.js — Vercel Serverless Function (Node 18)
// Proxy con failover: Yahoo Finance (BYMA .BA) → Finnhub
//
// Precios SIEMPRE en ARS desde BYMA:
//   baSymbol  = {ticker}.BA  — Yahoo Finance BYMA
//   fundTicker = ticker subyacente US para fundamentales
//     (ej: YPFD→YPF, PAMP→PAM; el resto igual)
//
// Fuentes (en orden de prioridad):
//   byma_full    — BYMA precio + Yahoo US fundamentales
//   byma+finnhub — BYMA precio + Finnhub fundamentales
//   byma_price   — BYMA precio sin fundamentales
//   [502]        — Ninguna fuente (frontend usa seed)
//
// Vars de entorno:
//   FINNHUB_API_KEY — (opcional) finnhub.io/dashboard
// ============================================================

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const HEADERS_BASE = {
  'User-Agent': UA,
  'Accept': 'application/json, text/html,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

// ── Mapeo BYMA → ticker subyacente US para fundamentales ────
// Sólo se necesita cuando el símbolo BYMA difiere del NYSE/NASDAQ
const FUND_MAP = {
  YPFD: 'YPF',  // YPFD en BYMA = YPF en NYSE
  PAMP: 'PAM',  // PAMP en BYMA = PAM en NYSE
}

// ── Helpers de formato ───────────────────────────────────────
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

// ── Caché en memoria (warm instance) ────────────────────────
let   _session    = null
const _priceCache = new Map()   // baSymbol  → { data, expiresAt }  45 s
const _fundCache  = new Map()   // fundTicker → { data, expiresAt }   5 min
const _fhCache    = new Map()   // fundTicker → { data, expiresAt }  60 s

// ── Crumb session ────────────────────────────────────────────
async function tryCrumb(originUrl) {
  const r1 = await fetch(originUrl, { headers: HEADERS_BASE, redirect: 'follow', signal: AbortSignal.timeout(10_000) })
  const cookie = (r1.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
  if (!cookie) return null
  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { ...HEADERS_BASE, Cookie: cookie }, signal: AbortSignal.timeout(8_000),
  })
  const text = (await r2.text()).trim()
  return isValidCrumb(text) ? { cookie, crumb: text } : null
}
async function getSession(forceRefresh = false) {
  if (!forceRefresh && _session?.expiresAt > Date.now()) return _session
  let result = null
  try { result = await tryCrumb('https://fc.yahoo.com') }       catch (_) {}
  if (!result) try { result = await tryCrumb('https://finance.yahoo.com') } catch (_) {}
  _session = result
    ? { ...result, expiresAt: Date.now() + 25 * 60_000 }
    : { cookie: '', crumb: null, expiresAt: Date.now() + 2 * 60_000 }
  return _session
}

// ── Normalizar desde Yahoo ───────────────────────────────────
// meta/closes vienen del .BA (precio ARS); sd/ks/fd/earn del subyacente US
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

// ── Normalizar desde Finnhub (fundamentales sólo) ───────────
// Se combina con el precio BYMA, así que no hay `source` aquí
function finnhubFundamentals(m, p) {
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

// ── Merge: BYMA precio + Finnhub fundamentales ───────────────
function mergeBymaFinnhub(bymaBase, m, p) {
  return {
    ...bymaBase,
    ...finnhubFundamentals(m, p),
    // Si BYMA no reportó 52W, usar Finnhub
    week52High: bymaBase.week52High ?? fmt(m['52WeekHigh']),
    week52Low:  bymaBase.week52Low  ?? fmt(m['52WeekLow']),
    currency: 'ARS',
    source: 'byma+finnhub',
  }
}

export default async function handler(req, res) {
  const { symbol } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol required' })

  const ticker     = symbol.toUpperCase()
  const baSymbol   = `${ticker}.BA`               // Yahoo BYMA — precio ARS
  const fundTicker = FUND_MAP[ticker] ?? ticker    // Subyacente US para fundamentales
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY || ''

  try {
    // ── 1. Yahoo chart desde BYMA (.BA) — precio en ARS ────
    let chartBody = _priceCache.get(baSymbol)?.expiresAt > Date.now()
      ? _priceCache.get(baSymbol).data : null

    if (!chartBody) {
      const cr = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(baSymbol)}?interval=1mo&range=1y`,
        { headers: HEADERS_BASE, signal: AbortSignal.timeout(10_000) }
      )
      if (cr.status === 429) throw new Error('429 rate limited')
      chartBody = cr.ok ? await cr.json() : null
      if (chartBody?.chart?.result?.[0]) _priceCache.set(baSymbol, { data: chartBody, expiresAt: Date.now() + 45_000 })
    }

    const chartResult   = chartBody?.chart?.result?.[0]
    const meta          = chartResult?.meta ?? {}
    const closes        = chartResult?.indicators?.quote?.[0]?.close ?? []
    const bymaHasPrice  = !!meta.regularMarketPrice

    // ── 2. Yahoo quoteSummary desde ticker subyacente US ───
    let summaryResult = _fundCache.get(fundTicker)?.expiresAt > Date.now()
      ? _fundCache.get(fundTicker).data : null

    if (!summaryResult && bymaHasPrice) {
      try {
        let session = await getSession()
        if (session.crumb) {
          const modules = 'summaryDetail,defaultKeyStatistics,financialData,earnings'
          const fetchSummary = async (crumb, cookie) => {
            const sr = await fetch(
              `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(fundTicker)}` +
              `?modules=${modules}&crumb=${encodeURIComponent(crumb)}`,
              { headers: { ...HEADERS_BASE, Cookie: cookie }, signal: AbortSignal.timeout(10_000) }
            )
            return sr.ok ? (await sr.json())?.quoteSummary?.result?.[0] ?? null : null
          }
          summaryResult = await fetchSummary(session.crumb, session.cookie)
          if (!summaryResult) {
            session = await getSession(true)
            if (session.crumb) summaryResult = await fetchSummary(session.crumb, session.cookie)
          }
          if (summaryResult) _fundCache.set(fundTicker, { data: summaryResult, expiresAt: Date.now() + 5 * 60_000 })
        }
      } catch { /* fundamentales best-effort */ }
    }

    const sd   = summaryResult?.summaryDetail        ?? {}
    const ks   = summaryResult?.defaultKeyStatistics ?? {}
    const fd   = summaryResult?.financialData        ?? {}
    const earn = summaryResult?.earnings?.financialsChart?.quarterly ?? []
    const hasFund = !!summaryResult

    // ── 3. Decisión de fuente ────────────────────────────────
    let payload

    if (bymaHasPrice && hasFund) {
      // Caso A: BYMA precio (ARS) + Yahoo US fundamentales
      payload = normalizeYahoo(meta, sd, ks, fd, earn, closes, true)

    } else if (bymaHasPrice && !hasFund && FINNHUB_KEY) {
      // Caso B: BYMA precio (ARS) + Finnhub fundamentales
      let fhData = _fhCache.get(fundTicker)?.expiresAt > Date.now()
        ? _fhCache.get(fundTicker).data : null
      if (!fhData) {
        try {
          const FH = `https://finnhub.io/api/v1`
          const [mRes, pRes] = await Promise.allSettled([
            fetch(`${FH}/stock/metric?symbol=${encodeURIComponent(fundTicker)}&metric=all&token=${FINNHUB_KEY}`, { signal: AbortSignal.timeout(8_000) }),
            fetch(`${FH}/stock/profile2?symbol=${encodeURIComponent(fundTicker)}&token=${FINNHUB_KEY}`,          { signal: AbortSignal.timeout(8_000) }),
          ])
          const mBody = mRes.status === 'fulfilled' && mRes.value.ok ? await mRes.value.json() : {}
          const pBody = pRes.status === 'fulfilled' && pRes.value.ok ? await pRes.value.json() : {}
          fhData = { m: mBody.metric ?? {}, p: pBody }
          _fhCache.set(fundTicker, { data: fhData, expiresAt: Date.now() + 60_000 })
        } catch { fhData = { m: {}, p: {} } }
      }
      const bymaBase = normalizeYahoo(meta, {}, {}, {}, [], closes, false)
      payload = mergeBymaFinnhub(bymaBase, fhData.m, fhData.p)

    } else if (bymaHasPrice) {
      // Caso C: BYMA precio sin fundamentales, sin Finnhub key
      payload = normalizeYahoo(meta, sd, ks, fd, earn, closes, false)

    } else {
      // Caso D: BYMA no disponible — sin datos de precio ARS
      return res.status(502).json({ error: 'no BYMA data available' })
    }

    res.setHeader('Cache-Control', 's-maxage=40, stale-while-revalidate=20')
    res.status(200).json(payload)
  } catch (err) {
    const code = err.message.includes('429') ? 429 : 502
    res.status(code).json({ error: err.message })
  }
}
