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
  if (abs >= 1e9)  return (n / 1e9).toFixed(2)  + 'B'
  if (abs >= 1e6)  return (n / 1e6).toFixed(2)  + 'M'
  return n.toLocaleString()
}

// ── Score (fórmula corregida — usa valores en %) ─────────────
// debtEq, revenueGrowth, returnOnEquity llegan como % (ej: 102.63, 5.12, 147.7)
function computeScore(d) {
  if (!d.pe && !d.revenueGrowth && !d.returnOnEquity) return null
  const pe  = d.pe             ?? 20
  const de  = d.debtEq         ?? 0    // % → dividir por 100 para la fórmula
  const rev = d.revenueGrowth  ?? 0    // % → dividir por 100
  const roe = d.returnOnEquity ?? 0    // % → dividir por 100
  const raw = 50
    - (de  / 100) * 2
    + (rev / 100) * 30
    + (roe / 100) * 10
    - Math.max(0, pe - 20) * 0.5
  return Math.min(100, Math.max(0, Math.round(raw)))
}

// ── Generador determinístico para datos no disponibles ───────
function seed(ticker) {
  let h = 0
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) | 0
  return Math.abs(h)
}
function detFloat(s, min, max, dec = 2) {
  const x = ((s * 9301 + 49297) % 233280) / 233280
  return parseFloat((min + x * (max - min)).toFixed(dec))
}

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
    ticker, price,
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
  }
}

// ── Fetch normalizado desde el proxy ─────────────────────────
// El backend ya devuelve datos normalizados (flat).
// El hook los mapea a la estructura que usan los componentes.
async function fetchLive(ticker) {
  const res = await fetch(`/api/quote?symbol=${encodeURIComponent(ticker)}`)
  if (!res.ok) throw new Error(`api ${res.status}`)
  const live = await res.json()
  if (!live.price) throw new Error('no price data')

  const fb = buildFallback(ticker)
  const score = computeScore(live) ?? fb.score

  return {
    ticker,
    price:     live.price,
    change:    live.change,
    changePct: live.changePct,
    volume:    live.volume    ?? fb.volume,
    marketCap: live.marketCap ?? fb.marketCap,
    week52High:live.week52High ?? fb.week52High,
    week52Low: live.week52Low  ?? fb.week52Low,
    score,

    // Estructura anidada que usan Page1 / Page2 / App
    valuation: {
      pe:        live.pe        ?? fb.valuation.pe,
      pb:        live.pb        ?? fb.valuation.pb,
      ps:        live.ps        ?? fb.valuation.ps,
      ev_ebitda: live.evEbitda  ?? fb.valuation.ev_ebitda,
    },
    financial: {
      debtEq:      live.debtEq       ?? fb.financial.debtEq,
      currentRatio:live.currentRatio ?? fb.financial.currentRatio,
      interestCov: live.interestCov  ?? fb.financial.interestCov,
      freeCashFlow:live.freeCashFlow ?? fb.financial.freeCashFlow,
    },
    growth: {
      revenueGrowth:live.revenueGrowth  ?? fb.growth.revenueGrowth,
      epsGrowth:    live.epsGrowth      ?? fb.growth.epsGrowth,
      marginTrend:  live.marginTrend    ?? fb.growth.marginTrend,
      returnEquity: live.returnOnEquity ?? fb.growth.returnEquity,
    },

    scores:          fb.scores,
    chartPrices:     live.chartPrices   ?? fb.chartPrices,
    quarterlyData:   live.quarterlyData ?? fb.quarterlyData,
    catalysts:       fb.catalysts,
    risks:           fb.risks,
    earningsUpdates: fb.earningsUpdates,
    deliveryUpdates: fb.deliveryUpdates,

    source:       live.source,
    hasLivePrice: true,
    isFallback:   live.source !== 'yahoo_full',
  }
}

// ── Hook principal ───────────────────────────────────────────
const REFRESH_INTERVAL_MS = 60_000

export function useStockData(ticker) {
  const [data,       setData]      = useState(null)
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState(null)
  const [lastUpdate, setLastUpdate]= useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const d = await fetchLive(ticker)
      setData(d)
      setLastUpdate(new Date())
    } catch {
      if (!silent) {
        setData(buildFallback(ticker))
        setError('live')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [ticker])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(() => load(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [load])

  return { data, loading, error, lastUpdate, reload: load }
}
