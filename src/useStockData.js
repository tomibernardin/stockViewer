import { useState, useEffect, useCallback } from 'react'

// ── Helpers ──────────────────────────────────────────────────
function fmt(n, digits = 2) {
  if (n == null || isNaN(n)) return null
  return parseFloat(n.toFixed(digits))
}

function fmtBig(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9)  return (n / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6)  return (n / 1e6).toFixed(2) + 'M'
  return n.toLocaleString()
}

// Generador determinístico para datos que no trae la API
function seed(ticker) {
  let h = 0
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) | 0
  return Math.abs(h)
}

function detFloat(s, min, max, dec = 2) {
  const x = ((s * 9301 + 49297) % 233280) / 233280
  return parseFloat((min + x * (max - min)).toFixed(dec))
}

// ── Fallback completo (cuando el proxy falla totalmente) ──────
function buildFallback(ticker) {
  const s     = seed(ticker)
  const price = detFloat(s, 10, 800)
  const months = 12
  const chartPrices = Array.from({ length: months }, (_, i) => {
    const base  = price * 0.75
    const trend = (price - base) * (i / (months - 1))
    const noise = detFloat(s + i * 17, -price * 0.05, price * 0.05)
    return parseFloat((base + trend + noise).toFixed(2))
  })

  return {
    ticker,
    price,
    change:    fmt(detFloat(s ^ 0xff, -8, 8)),
    changePct: fmt(detFloat(s ^ 0xab, -5, 5)),
    volume:    fmtBig(Math.round(detFloat(s ^ 0x3, 1e6, 100e6))),
    marketCap: fmtBig(Math.round(detFloat(s ^ 0x4, 5e9, 3e12))),
    week52High:fmt(price * detFloat(s ^ 0x5, 1.05, 1.5)),
    week52Low: fmt(price * detFloat(s ^ 0x6, 0.5, 0.95)),
    score: Math.round(detFloat(s ^ 0x12, 20, 85)),
    valuation: {
      pe:        fmt(detFloat(s ^ 0x10, 8, 60)),
      pb:        fmt(detFloat(s ^ 0x11, 0.5, 12)),
      ps:        fmt(detFloat(s ^ 0x12, 0.5, 20)),
      ev_ebitda: fmt(detFloat(s ^ 0x13, 5, 40)),
    },
    financial: {
      debtEq:      fmt(detFloat(s ^ 0x20, 0, 3)),
      currentRatio:fmt(detFloat(s ^ 0x21, 0.5, 4)),
      interestCov: fmt(detFloat(s ^ 0x22, 1, 20)),
      freeCashFlow:fmtBig(Math.round(detFloat(s ^ 0x23, 1e8, 50e9))),
    },
    growth: {
      revenueGrowth:fmt(detFloat(s ^ 0x30, -10, 40)),
      epsGrowth:    fmt(detFloat(s ^ 0x31, -20, 60)),
      marginTrend:  fmt(detFloat(s ^ 0x32, -5, 10)),
      returnEquity: fmt(detFloat(s ^ 0x33, 2, 50)),
    },
    scores: {
      valuation: Math.round(detFloat(s ^ 0x40, 20, 90)),
      financial:  Math.round(detFloat(s ^ 0x41, 20, 90)),
      growth:     Math.round(detFloat(s ^ 0x42, 20, 90)),
    },
    chartPrices,
    quarterlyData: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024'].map((q, i) => ({
      quarter:   q,
      revenue:   fmtBig(Math.round(detFloat(s + i, 1e9, 50e9))),
      eps:       detFloat(s + i * 7, 0.5, 8),
      netIncome: fmtBig(Math.round(detFloat(s + i * 3, 1e8, 10e9))),
      margin:    detFloat(s + i * 11, 5, 35),
      epsStatus: ['beats','beats','misses','caution'][i % 4],
    })),
    catalysts: [
      'Strong free cash flow generation',
      'Market share expansion in core segments',
      'New product cycle underway',
      'Analyst upgrades accelerating',
    ],
    risks: [
      'Macro headwinds may pressure margins',
      'Elevated valuation vs. sector peers',
      'Regulatory scrutiny increasing',
      'FX exposure in emerging markets',
    ],
    earningsUpdates: [
      `Q4 2024: EPS $${fmt(detFloat(s, 0.5, 8))} vs est $${fmt(detFloat(s ^ 1, 0.4, 7.8))} — ${detFloat(s, 0, 1) > 0.5 ? 'Beat' : 'Miss'}`,
      `Q3 2024: Revenue ${fmtBig(Math.round(detFloat(s ^ 2, 1e9, 50e9)))} — inline with estimates`,
    ],
    deliveryUpdates: [
      `FY2024 units: ${Math.round(detFloat(s ^ 3, 1e4, 5e6)).toLocaleString()} (+${fmt(detFloat(s ^ 4, 5, 30))}% YoY)`,
      'Guidance maintained for FY2025',
    ],
    isFallback: true,
  }
}

// ── Normaliza la respuesta del proxy ─────────────────────────
// Usa el chart meta para precio/volumen (siempre disponible)
// y quoteSummary para fundamentales (best-effort con crumb)
async function fetchLive(ticker) {
  const res = await fetch(`/api/quote?symbol=${encodeURIComponent(ticker)}`)
  if (!res.ok) throw new Error(`api ${res.status}`)
  const { summary, chart } = await res.json()

  // Chart meta — siempre disponible sin crumb
  const meta   = chart?.chart?.result?.[0]?.meta ?? {}
  const closes = chart?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
  const chartPrices = closes.map(v => (v ? parseFloat(v.toFixed(2)) : null)).filter(Boolean)

  // quoteSummary — disponible solo cuando el crumb funciona
  const r  = summary?.quoteSummary?.result?.[0] ?? null
  const sd = r?.summaryDetail        ?? {}
  const ks = r?.defaultKeyStatistics ?? {}
  const fd = r?.financialData        ?? {}
  const earn = r?.earnings?.financialsChart?.quarterly ?? []

  const hasSummary = !!r

  const fb    = buildFallback(ticker)
  const price = meta.regularMarketPrice ?? sd.regularMarketPrice?.raw ?? fb.price

  const score = hasSummary
    ? Math.min(100, Math.max(0, Math.round(
        50
        - (fd.debtToEquity?.raw   ?? 0) * 2
        + (fd.revenueGrowth?.raw  ?? 0) * 30
        + (fd.returnOnEquity?.raw ?? 0) * 10
        - Math.max(0, (sd.trailingPE?.raw ?? 20) - 20) * 0.5
      )))
    : fb.score

  return {
    ticker,
    price:     fmt(price),
    change:    fmt(meta.regularMarketChange     ?? sd.regularMarketChange?.raw),
    changePct: fmt((meta.regularMarketChangePercent ?? (sd.regularMarketChangePercent?.raw ?? 0)) ),
    volume:    fmtBig(meta.regularMarketVolume  ?? sd.regularMarketVolume?.raw),
    marketCap: fmtBig(meta.marketCap            ?? sd.marketCap?.raw),
    week52High:fmt(meta.fiftyTwoWeekHigh        ?? sd.fiftyTwoWeekHigh?.raw),
    week52Low: fmt(meta.fiftyTwoWeekLow         ?? sd.fiftyTwoWeekLow?.raw),
    score:     isNaN(score) ? fb.score : score,

    // Fundamentales: reales si hay quoteSummary, seed si no
    valuation: hasSummary ? {
      pe:        fmt(sd.trailingPE?.raw),
      pb:        fmt(sd.priceToBook?.raw ?? ks.priceToBook?.raw),
      ps:        fmt(ks.priceToSalesTrailing12Months?.raw),
      ev_ebitda: fmt(ks.enterpriseToEbitda?.raw),
    } : fb.valuation,

    financial: hasSummary ? {
      debtEq:      fmt(fd.debtToEquity?.raw),
      currentRatio:fmt(fd.currentRatio?.raw),
      interestCov: fmt(fd.ebitda?.raw && fd.totalDebt?.raw
        ? fd.ebitda.raw / (fd.totalDebt.raw * 0.05) : null),
      freeCashFlow:fmtBig(fd.freeCashflow?.raw),
    } : fb.financial,

    growth: hasSummary ? {
      revenueGrowth:fmt((fd.revenueGrowth?.raw   ?? 0) * 100),
      epsGrowth:    fmt((fd.earningsGrowth?.raw   ?? 0) * 100),
      marginTrend:  fmt((fd.grossMargins?.raw     ?? 0) * 100),
      returnEquity: fmt((fd.returnOnEquity?.raw   ?? 0) * 100),
    } : fb.growth,

    scores: fb.scores,
    chartPrices: chartPrices.length >= 3 ? chartPrices : fb.chartPrices,

    quarterlyData: earn.length
      ? earn.slice(-4).map(q => ({
          quarter:   q.date,
          revenue:   fmtBig(q.revenue?.raw),
          eps:       fmt(q.earnings?.raw),
          netIncome: '—',
          margin:    null,
          epsStatus: (q.earnings?.raw ?? 0) > 0 ? 'beats' : 'misses',
        }))
      : fb.quarterlyData,

    catalysts:       fb.catalysts,
    risks:           fb.risks,
    earningsUpdates: fb.earningsUpdates,
    deliveryUpdates: fb.deliveryUpdates,
    // Modo parcial: hay datos reales de precio pero fundamentales son estimados
    isFallback: !hasSummary,
    hasLivePrice: !!meta.regularMarketPrice,
  }
}

// ── Hook principal ───────────────────────────────────────────
// Intervalo de auto-refresh: 60s (Yahoo Finance actualiza precios cada ~15-60s).
// En el refresh silencioso no mostramos spinner — solo actualizamos los datos.
const REFRESH_INTERVAL_MS = 60_000

export function useStockData(ticker) {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [lastUpdate,setLastUpdate]= useState(null)

  // Carga inicial (con spinner) o silent refresh (sin spinner)
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const d = await fetchLive(ticker)
      setData(d)
      setLastUpdate(new Date())
      if (!d.hasLivePrice) setError('live')
    } catch {
      if (!silent) {
        setData(buildFallback(ticker))
        setError('live')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [ticker])

  // Carga inicial al montar o cambiar ticker
  useEffect(() => { load() }, [load])

  // Auto-refresh cada 60s (no muestra spinner)
  useEffect(() => {
    const id = setInterval(() => load(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)  // cleanup al desmontar o cambiar ticker
  }, [load])

  return { data, loading, error, lastUpdate, reload: load }
}
