// ============================================================
// api/quote.js — Vercel Serverless Function (Node 18)
// Proxy con failover: Yahoo Finance → Finnhub
//
// Fuentes (en orden de prioridad):
//   yahoo_full    — Yahoo chart + quoteSummary (crumb ok)
//   yahoo+finnhub — Yahoo chart (precio) + Finnhub (fundamentales)
//   finnhub       — Todo desde Finnhub (Yahoo chart falló)
//   [502]         — Ninguna fuente disponible (frontend usa seed)
//
// Vars de entorno necesarias:
//   FINNHUB_API_KEY — (opcional) obtener en finnhub.io/dashboard
// ============================================================

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const HEADERS_BASE = {
  'User-Agent': UA,
  'Accept': 'application/json, text/html,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
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
const _priceCache = new Map()   // ticker → { data, expiresAt }  45 s
const _fundCache  = new Map()   // ticker → { data, expiresAt }   5 min
const _fhCache    = new Map()   // ticker → { data, expiresAt }  60 s

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
    source: hasFund ? 'yahoo_full' : 'yahoo_price',
  }
}

// ── Normalizar desde Finnhub ─────────────────────────────────
function normalizeFinnhub(q, m, p, candle) {
  const chartPrices = candle?.s === 'ok'
    ? (candle.c ?? []).filter(Boolean).map(v => parseFloat(v.toFixed(2))) : null
  return {
    price:     fmt(q.c),
    change:    fmt(q.d),
    changePct: fmt(q.dp),    // Finnhub ya da porcentaje
    volume:    null,
    marketCap: p.marketCapitalization ? fmtBig(p.marketCapitalization * 1e6) : null,
    week52High: fmt(m['52WeekHigh']),
    week52Low:  fmt(m['52WeekLow']),
    pe:        fmt(m.peBasicExclExtraTTM ?? m.peTTM),
    pb:        fmt(m.pbAnnual ?? m.pbQuarterly),
    ps:        fmt(m.psAnnual ?? m.psTTM),
    evEbitda:  fmt(m.evEbitdaTTM ?? m.evEbitdaAnnual),
    debtEq:    fmt(m['totalDebt/totalEquityAnnual'] ?? m['totalDebt/totalEquityQuarterly']),
    currentRatio: fmt(m.currentRatioAnnual ?? m.currentRatioQuarterly),
    interestCov:  null,
    freeCashFlow: m.freeCashFlowAnnual ? fmtBig(m.freeCashFlowAnnual * 1e6) : null,
    revenueGrowth:  m.revenueGrowthTTMYoy != null ? fmt(m.revenueGrowthTTMYoy * 100) : null,
    epsGrowth:      null,
    marginTrend:    fmt(m.grossMarginTTM ?? m.grossMarginAnnual),
    returnOnEquity: fmt(m.roeTTM ?? m.roeAnnual),
    chartPrices: chartPrices?.length >= 3 ? chartPrices : null,
    quarterlyData: null,
    source: 'finnhub',
  }
}

// ── Merge: Yahoo precio + Finnhub fundamentales ──────────────
function mergeYahooFinnhub(yahooBase, m, p) {
  return {
    ...yahooBase,
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
    source: 'yahoo+finnhub',
  }
}

export default async function handler(req, res) {
  const { symbol } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol required' })
  const ticker = symbol.toUpperCase()
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY || ''

  try {
    // ── 1. Yahoo chart (precio, sin crumb) ──────────────────
    let chartBody = _priceCache.get(ticker)?.expiresAt > Date.now()
      ? _priceCache.get(ticker).data : null

    if (!chartBody) {
      const cr = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=1y`,
        { headers: HEADERS_BASE, signal: AbortSignal.timeout(10_000) }
      )
      if (cr.status === 429) throw new Error('429 rate limited')
      chartBody = cr.ok ? await cr.json() : null
      if (chartBody?.chart?.result?.[0]) _priceCache.set(ticker, { data: chartBody, expiresAt: Date.now() + 45_000 })
    }

    const chartResult = chartBody?.chart?.result?.[0]
    const meta   = chartResult?.meta ?? {}
    const closes = chartResult?.indicators?.quote?.[0]?.close ?? []
    const yahooHasPrice = !!meta.regularMarketPrice

    // ── 2. Yahoo quoteSummary (fundamentales, con crumb) ────
    let summaryResult = _fundCache.get(ticker)?.expiresAt > Date.now()
      ? _fundCache.get(ticker).data : null

    if (!summaryResult && yahooHasPrice) {
      try {
        let session = await getSession()
        if (session.crumb) {
          const modules = 'summaryDetail,defaultKeyStatistics,financialData,earnings'
          const sr = await fetch(
            `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
            `?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
            { headers: { ...HEADERS_BASE, Cookie: session.cookie }, signal: AbortSignal.timeout(10_000) }
          )
          if (sr.status === 401) {
            session = await getSession(true)
            if (session.crumb) {
              const sr2 = await fetch(
                `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
                `?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
                { headers: { ...HEADERS_BASE, Cookie: session.cookie }, signal: AbortSignal.timeout(10_000) }
              )
              if (sr2.ok) summaryResult = (await sr2.json())?.quoteSummary?.result?.[0] ?? null
            }
          } else if (sr.ok) {
            summaryResult = (await sr.json())?.quoteSummary?.result?.[0] ?? null
          }
          if (summaryResult) _fundCache.set(ticker, { data: summaryResult, expiresAt: Date.now() + 5 * 60_000 })
        }
      } catch { /* fundamentales son best-effort */ }
    }

    const sd   = summaryResult?.summaryDetail        ?? {}
    const ks   = summaryResult?.defaultKeyStatistics ?? {}
    const fd   = summaryResult?.financialData        ?? {}
    const earn = summaryResult?.earnings?.financialsChart?.quarterly ?? []
    const hasFund = !!summaryResult

    // ── 3. Decisión de fuente ────────────────────────────────
    let payload

    if (yahooHasPrice && hasFund) {
      // Caso A: Yahoo completo
      payload = normalizeYahoo(meta, sd, ks, fd, earn, closes, true)

    } else if (yahooHasPrice && !hasFund && FINNHUB_KEY) {
      // Caso B: Yahoo precio + Finnhub fundamentales
      let fhData = _fhCache.get(ticker)?.expiresAt > Date.now()
        ? _fhCache.get(ticker).data : null
      if (!fhData) {
        try {
          const FH = `https://finnhub.io/api/v1`
          const [mRes, pRes] = await Promise.allSettled([
            fetch(`${FH}/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all&token=${FINNHUB_KEY}`, { signal: AbortSignal.timeout(8_000) }),
            fetch(`${FH}/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`,          { signal: AbortSignal.timeout(8_000) }),
          ])
          const mBody = mRes.status === 'fulfilled' && mRes.value.ok ? await mRes.value.json() : {}
          const pBody = pRes.status === 'fulfilled' && pRes.value.ok ? await pRes.value.json() : {}
          fhData = { m: mBody.metric ?? {}, p: pBody }
          _fhCache.set(ticker, { data: fhData, expiresAt: Date.now() + 60_000 })
        } catch { fhData = { m: {}, p: {} } }
      }
      const yahooBase = normalizeYahoo(meta, {}, {}, {}, [], closes, false)
      payload = mergeYahooFinnhub(yahooBase, fhData.m, fhData.p)

    } else if (yahooHasPrice && !hasFund) {
      // Caso C: Yahoo precio sin fundamentales, sin Finnhub
      payload = normalizeYahoo(meta, sd, ks, fd, earn, closes, false)

    } else if (!yahooHasPrice && FINNHUB_KEY) {
      // Caso D: Finnhub completo
      let fhData = _fhCache.get(ticker)?.expiresAt > Date.now()
        ? _fhCache.get(ticker).data : null
      if (!fhData) {
        try {
          const FH  = `https://finnhub.io/api/v1`
          const now = Math.floor(Date.now() / 1000)
          const yr  = now - 365 * 86400
          const [qRes, mRes, pRes, cRes] = await Promise.allSettled([
            fetch(`${FH}/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`,                                                      { signal: AbortSignal.timeout(8_000) }),
            fetch(`${FH}/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all&token=${FINNHUB_KEY}`,                                     { signal: AbortSignal.timeout(8_000) }),
            fetch(`${FH}/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`,                                              { signal: AbortSignal.timeout(8_000) }),
            fetch(`${FH}/stock/candle?symbol=${encodeURIComponent(ticker)}&resolution=M&from=${yr}&to=${now}&token=${FINNHUB_KEY}`,              { signal: AbortSignal.timeout(8_000) }),
          ])
          fhData = {
            q: qRes.status === 'fulfilled' && qRes.value.ok ? await qRes.value.json() : {},
            m: (mRes.status === 'fulfilled' && mRes.value.ok ? await mRes.value.json() : {}).metric ?? {},
            p: pRes.status === 'fulfilled' && pRes.value.ok ? await pRes.value.json() : {},
            c: cRes.status === 'fulfilled' && cRes.value.ok ? await cRes.value.json() : {},
          }
          _fhCache.set(ticker, { data: fhData, expiresAt: Date.now() + 60_000 })
        } catch { fhData = { q: {}, m: {}, p: {}, c: {} } }
      }
      if (!fhData.q?.c) return res.status(502).json({ error: 'no data from any source' })
      payload = normalizeFinnhub(fhData.q, fhData.m, fhData.p, fhData.c)

    } else {
      return res.status(502).json({ error: 'no data from any source' })
    }

    res.setHeader('Cache-Control', 's-maxage=40, stale-while-revalidate=20')
    res.status(200).json(payload)
  } catch (err) {
    const code = err.message.includes('429') ? 429 : 502
    res.status(code).json({ error: err.message })
  }
}
