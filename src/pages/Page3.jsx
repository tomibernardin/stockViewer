// ============================================================
// Page3 — Compare
// Comparación lado a lado de dos acciones.
// Mobile: una columna apilada. sm+: dos columnas.
// Verde = mejor valor en ese metric. Rojo = peor.
// ============================================================
import RiskGauge from '../components/RiskGauge'

// ── Dual price chart (normalizado a % desde el inicio) ──────
function DualChart({ prices1, ticker1, prices2, ticker2 }) {
  if (!prices1?.length || !prices2?.length) return null

  const W = 600, H = 160, PAD = 24

  // Normalize both to % return from first point
  function normalize(prices) {
    const base = prices[0] || 1
    return prices.map(p => ((p - base) / base) * 100)
  }

  const n1 = normalize(prices1)
  const n2 = normalize(prices2)
  const allVals = [...n1, ...n2]
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const range = maxV - minV || 1

  function toPoints(normed) {
    return normed.map((v, i) => {
      const x = PAD + (i / (normed.length - 1)) * (W - PAD * 2)
      const y = PAD + (1 - (v - minV) / range) * (H - PAD * 2)
      return [x, y]
    })
  }

  const pts1 = toPoints(n1)
  const pts2 = toPoints(n2)

  const up1 = n1[n1.length - 1] >= 0
  const up2 = n2[n2.length - 1] >= 0

  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now = new Date()
  const labels = prices1.map((_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - (prices1.length - 1 - i))
    return monthLabels[d.getMonth()]
  })

  const ret1 = n1[n1.length - 1]
  const ret2 = n2[n2.length - 1]

  // Zero line
  const zeroY = PAD + (1 - (0 - minV) / range) * (H - PAD * 2)
  const showZero = zeroY > PAD && zeroY < H - PAD

  return (
    <div className="w-full overflow-hidden">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="block w-4 h-0.5 bg-blue-400 rounded" />
          <span className="text-[10px] font-mono text-slate-400">{ticker1}</span>
          <span className={`text-[10px] font-mono font-semibold ${up1 ? 'text-green-400' : 'text-red-400'}`}>
            {ret1 >= 0 ? '+' : ''}{ret1.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="block w-4 h-0.5 bg-amber-400 rounded" />
          <span className="text-[10px] font-mono text-slate-400">{ticker2}</span>
          <span className={`text-[10px] font-mono font-semibold ${up2 ? 'text-green-400' : 'text-red-400'}`}>
            {ret2 >= 0 ? '+' : ''}{ret2.toFixed(1)}%
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" preserveAspectRatio="none">
        {showZero && (
          <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY}
            stroke="#1e2130" strokeWidth={1} strokeDasharray="4 3" />
        )}
        {/* Line 1 — blue */}
        <polyline
          points={pts1.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeLinejoin="round"
        />
        {/* Line 2 — amber */}
        <polyline
          points={pts2.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeLinejoin="round"
        />
        {/* Month labels — every other point */}
        {labels.map((lbl, i) => i % 2 === 0 && (
          <text key={i}
            x={PAD + (i / (labels.length - 1)) * (W - PAD * 2)}
            y={H + 14}
            textAnchor="middle"
            fill="#64748b"
            style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}>
            {lbl}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── Comparison row ───────────────────────────────────────────
// direction: 'lower' | 'higher' | 'neutral'
function CompRow({ label, v1, v2, direction, isLast }) {
  const parse = v => {
    if (v == null || v === '—') return null
    if (typeof v === 'number') return v
    // Handle formatted strings like "25.3B", "1.2T", "500M", etc.
    const s = String(v).replace(/[$,%]/g, '')
    if (s.endsWith('T')) return parseFloat(s) * 1e12
    if (s.endsWith('B')) return parseFloat(s) * 1e9
    if (s.endsWith('M')) return parseFloat(s) * 1e6
    return parseFloat(s)
  }

  const n1 = parse(v1)
  const n2 = parse(v2)

  let win1 = false, win2 = false
  if (n1 != null && n2 != null && n1 !== n2 && direction !== 'neutral') {
    if (direction === 'lower') {
      win1 = n1 < n2
      win2 = n2 < n1
    } else {
      win1 = n1 > n2
      win2 = n2 > n1
    }
  }

  const cell = (val, win, lose) => (
    <span className={`font-mono text-sm font-semibold ${
      win ? 'text-green-400' : lose ? 'text-red-400' : 'text-white'
    }`}>
      {val ?? '—'}
    </span>
  )

  return (
    <div className={`grid grid-cols-3 items-center gap-2 py-2.5 ${
      !isLast ? 'border-b border-[#1e2130]' : ''
    }`}>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 leading-tight">{label}</span>
      </div>
      <div className="text-center">{cell(v1, win1, win2)}</div>
      <div className="text-center">{cell(v2, win2, win1)}</div>
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────
function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 border-b border-[#1e2130] pb-1.5">
        {title}
      </h2>
      {children}
    </section>
  )
}

// ── Stock header card ────────────────────────────────────────
function StockHeader({ data, color, tr }) {
  if (!data) return (
    <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 flex items-center justify-center">
      <span className="font-mono text-xs text-slate-600">{tr.loading}</span>
    </div>
  )

  const up = (data.changePct ?? 0) >= 0
  return (
    <div className={`bg-[#0f1117] border rounded-xl p-4 flex flex-col gap-3 ${
      color === 'blue' ? 'border-blue-500/30' : 'border-amber-500/30'
    }`}>
      {/* Ticker + price */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`font-mono font-bold text-lg ${color === 'blue' ? 'text-blue-400' : 'text-amber-400'}`}>
            {data.ticker}
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono font-bold text-white text-2xl">${data.price?.toLocaleString('es-AR')}</span>
            <span className={`font-mono text-xs font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
              {up ? '+' : ''}{data.changePct}%
            </span>
          </div>
        </div>
        {/* Mini gauge */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <span className="text-[9px] font-mono uppercase text-slate-600 tracking-wider">{tr.riskScore}</span>
          <span className={`font-mono font-bold text-xl ${
            data.score >= 67 ? 'text-green-400' : data.score >= 34 ? 'text-amber-400' : 'text-red-400'
          }`}>{data.score}</span>
          <span className="text-[9px] font-mono text-slate-600">/100</span>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: tr.marketCap, val: data.marketCap },
          { label: tr.volume,    val: data.volume    },
          { label: tr.week52High, val: data.week52High ? `$${data.week52High}` : '—' },
          { label: tr.week52Low,  val: data.week52Low  ? `$${data.week52Low}`  : '—' },
        ].map(({ label, val }) => (
          <div key={label} className="bg-[#0a0c12] rounded-lg p-2">
            <div className="text-[9px] font-mono uppercase text-slate-600 tracking-wider leading-tight">{label}</div>
            <div className="font-mono text-xs font-semibold text-white leading-tight mt-0.5">{val ?? '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function Page3({ data1, data2, ticker1, ticker2, tr }) {
  const loading1 = !data1
  const loading2 = !data2

  // Column headers for the comparison table
  const ColHeader = ({ ticker, color }) => (
    <span className={`font-mono text-xs font-bold ${color === 'blue' ? 'text-blue-400' : 'text-amber-400'}`}>
      {ticker}
    </span>
  )

  // Metric sections config
  const valuationRows = [
    { label: tr.pe,        k1: data1?.valuation?.pe,        k2: data2?.valuation?.pe,        dir: 'lower' },
    { label: tr.pb,        k1: data1?.valuation?.pb,        k2: data2?.valuation?.pb,        dir: 'lower' },
    { label: tr.ps,        k1: data1?.valuation?.ps,        k2: data2?.valuation?.ps,        dir: 'lower' },
    { label: tr.ev_ebitda, k1: data1?.valuation?.ev_ebitda, k2: data2?.valuation?.ev_ebitda, dir: 'lower' },
  ]
  const financialRows = [
    { label: tr.debtEq,      k1: data1?.financial?.debtEq,      k2: data2?.financial?.debtEq,      dir: 'lower' },
    { label: tr.currentRatio, k1: data1?.financial?.currentRatio, k2: data2?.financial?.currentRatio, dir: 'higher' },
    { label: tr.interestCov,  k1: data1?.financial?.interestCov,  k2: data2?.financial?.interestCov,  dir: 'higher' },
    { label: tr.freeCashFlow, k1: data1?.financial?.freeCashFlow, k2: data2?.financial?.freeCashFlow, dir: 'higher' },
  ]
  const growthRows = [
    { label: tr.revenueGrowth, k1: data1?.growth?.revenueGrowth, k2: data2?.growth?.revenueGrowth, dir: 'higher' },
    { label: tr.epsGrowth,     k1: data1?.growth?.epsGrowth,     k2: data2?.growth?.epsGrowth,     dir: 'higher' },
    { label: tr.marginTrend,   k1: data1?.growth?.marginTrend,   k2: data2?.growth?.marginTrend,   dir: 'higher' },
    { label: tr.returnEquity,  k1: data1?.growth?.returnEquity,  k2: data2?.growth?.returnEquity,  dir: 'higher' },
  ]

  // Count wins per stock across all metrics
  function countWins(rows) {
    let w1 = 0, w2 = 0
    rows.forEach(({ k1, k2, dir }) => {
      if (k1 == null || k2 == null || dir === 'neutral') return
      const parse = v => {
        if (typeof v === 'number') return v
        const s = String(v).replace(/[$,%]/g, '')
        if (s.endsWith('T')) return parseFloat(s) * 1e12
        if (s.endsWith('B')) return parseFloat(s) * 1e9
        if (s.endsWith('M')) return parseFloat(s) * 1e6
        return parseFloat(s)
      }
      const n1 = parse(k1), n2 = parse(k2)
      if (isNaN(n1) || isNaN(n2) || n1 === n2) return
      if (dir === 'lower') { if (n1 < n2) w1++; else w2++ }
      else                 { if (n1 > n2) w1++; else w2++ }
    })
    return { w1, w2 }
  }

  const allRows = [...valuationRows, ...financialRows, ...growthRows]
  const { w1, w2 } = countWins(allRows)
  const totalMetrics = allRows.filter(r => r.k1 != null && r.k2 != null).length

  // Composite: score + metric wins
  const score1 = data1?.score ?? 0
  const score2 = data2?.score ?? 0

  return (
    <div className="flex flex-col gap-5">

      {/* ── Stock headers ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StockHeader data={data1} color="blue"  tr={tr} />
        <StockHeader data={data2} color="amber" tr={tr} />
      </div>

      {/* ── Dual price chart ──────────────────────────────── */}
      {(data1?.chartPrices || data2?.chartPrices) && (
        <Section title={tr.pricePerf}>
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-3 sm:p-4">
            <DualChart
              prices1={data1?.chartPrices}
              ticker1={ticker1}
              prices2={data2?.chartPrices}
              ticker2={ticker2}
            />
          </div>
        </Section>
      )}

      {/* ── Overall winner ────────────────────────────────── */}
      {data1 && data2 && (
        <Section title={tr.winner}>
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4">
            <div className="grid grid-cols-3 gap-3 items-center">
              {/* Stock 1 score */}
              <div className="flex flex-col items-center gap-1">
                <span className="font-mono text-xs font-bold text-blue-400">{ticker1}</span>
                <span className={`font-mono font-bold text-3xl ${
                  score1 >= 67 ? 'text-green-400' : score1 >= 34 ? 'text-amber-400' : 'text-red-400'
                }`}>{score1}</span>
                <span className="text-[9px] font-mono text-slate-600">{tr.riskScore}</span>
                <span className={`text-xs font-mono font-semibold mt-1 ${
                  w1 > w2 ? 'text-green-400' : w1 < w2 ? 'text-red-400' : 'text-slate-400'
                }`}>{w1}/{totalMetrics} {tr.better}</span>
              </div>

              {/* VS divider */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-slate-600 font-mono text-lg font-bold">{tr.vs}</span>
                {w1 !== w2 || score1 !== score2 ? (
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    (w1 > w2 || (w1 === w2 && score1 > score2))
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {(w1 > w2 || (w1 === w2 && score1 > score2)) ? ticker1 : ticker2}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500">{tr.tie}</span>
                )}
              </div>

              {/* Stock 2 score */}
              <div className="flex flex-col items-center gap-1">
                <span className="font-mono text-xs font-bold text-amber-400">{ticker2}</span>
                <span className={`font-mono font-bold text-3xl ${
                  score2 >= 67 ? 'text-green-400' : score2 >= 34 ? 'text-amber-400' : 'text-red-400'
                }`}>{score2}</span>
                <span className="text-[9px] font-mono text-slate-600">{tr.riskScore}</span>
                <span className={`text-xs font-mono font-semibold mt-1 ${
                  w2 > w1 ? 'text-green-400' : w2 < w1 ? 'text-red-400' : 'text-slate-400'
                }`}>{w2}/{totalMetrics} {tr.better}</span>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Metrics table ─────────────────────────────────── */}
      {data1 && data2 && (
        <>
          {/* Table column headers */}
          <div className="grid grid-cols-3 gap-2 px-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">Metric</span>
            <div className="text-center"><ColHeader ticker={ticker1} color="blue" /></div>
            <div className="text-center"><ColHeader ticker={ticker2} color="amber" /></div>
          </div>

          {/* Valuation */}
          <Section title={`${tr.valuation} — ${tr.lowerBetter}`}>
            <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl px-4">
              {valuationRows.map((r, i) => (
                <CompRow key={r.label} label={r.label} v1={r.k1} v2={r.k2}
                  direction={r.dir} isLast={i === valuationRows.length - 1} />
              ))}
            </div>
          </Section>

          {/* Financial Health */}
          <Section title={tr.financialHealth}>
            <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl px-4">
              {financialRows.map((r, i) => (
                <CompRow key={r.label} label={r.label} v1={r.k1} v2={r.k2}
                  direction={r.dir} isLast={i === financialRows.length - 1} />
              ))}
            </div>
          </Section>

          {/* Growth */}
          <Section title={`${tr.growth} — ${tr.higherBetter}`}>
            <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl px-4">
              {growthRows.map((r, i) => (
                <CompRow key={r.label} label={r.label} v1={r.k1} v2={r.k2}
                  direction={r.dir} isLast={i === growthRows.length - 1} />
              ))}
            </div>
          </Section>

          {/* Quarterly earnings side-by-side */}
          {data1.quarterlyData && data2.quarterlyData && (
            <Section title={tr.quarterly}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { d: data1, color: 'blue',  ticker: ticker1 },
                  { d: data2, color: 'amber', ticker: ticker2 },
                ].map(({ d, color, ticker }) => (
                  <div key={ticker} className="bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden">
                    <div className={`px-3 py-2 border-b border-[#1e2130] ${
                      color === 'blue' ? 'bg-blue-500/10' : 'bg-amber-500/10'
                    }`}>
                      <span className={`font-mono text-xs font-bold ${
                        color === 'blue' ? 'text-blue-400' : 'text-amber-400'
                      }`}>{ticker}</span>
                    </div>
                    <div className="divide-y divide-[#1e2130]">
                      {d.quarterlyData.map(q => (
                        <div key={q.quarter} className="px-3 py-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-slate-500">{q.quarter}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-300">{q.revenue}</span>
                            <span className="text-[10px] font-mono text-slate-400">{tr.eps} {q.eps}</span>
                            <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                              q.epsStatus === 'beats'  ? 'bg-green-500/15 text-green-400' :
                              q.epsStatus === 'misses' ? 'bg-red-500/15 text-red-400'    :
                                                         'bg-amber-500/15 text-amber-400'
                            }`}>
                              {q.epsStatus === 'beats' ? tr.beats : q.epsStatus === 'misses' ? tr.misses : tr.caution}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Catalysts side-by-side — from i18n (same list, language-aware) */}
          <Section title={tr.catalysts}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { color: 'blue',  ticker: ticker1 },
                { color: 'amber', ticker: ticker2 },
              ].map(({ color, ticker }) => (
                <div key={ticker} className="bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden">
                  <div className={`px-3 py-2 border-b border-[#1e2130] ${
                    color === 'blue' ? 'bg-blue-500/10' : 'bg-amber-500/10'
                  }`}>
                    <span className={`font-mono text-xs font-bold ${
                      color === 'blue' ? 'text-blue-400' : 'text-amber-400'
                    }`}>{ticker}</span>
                  </div>
                  <ul className="divide-y divide-[#1e2130]">
                    {tr.catalystsList.map((c, i) => (
                      <li key={i} className="px-3 py-2 flex items-start gap-2">
                        <span className="text-green-500 text-xs mt-0.5 shrink-0">+</span>
                        <span className="text-xs font-mono text-slate-300 leading-snug">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* Risks side-by-side */}
          <Section title={tr.risks}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { color: 'blue',  ticker: ticker1 },
                { color: 'amber', ticker: ticker2 },
              ].map(({ color, ticker }) => (
                <div key={ticker} className="bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden">
                  <div className={`px-3 py-2 border-b border-[#1e2130] ${
                    color === 'blue' ? 'bg-blue-500/10' : 'bg-amber-500/10'
                  }`}>
                    <span className={`font-mono text-xs font-bold ${
                      color === 'blue' ? 'text-blue-400' : 'text-amber-400'
                    }`}>{ticker}</span>
                  </div>
                  <ul className="divide-y divide-[#1e2130]">
                    {tr.risksList.map((r, i) => (
                      <li key={i} className="px-3 py-2 flex items-start gap-2">
                        <span className="text-red-500 text-xs mt-0.5 shrink-0">–</span>
                        <span className="text-xs font-mono text-slate-300 leading-snug">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* Loading state */}
      {(loading1 || loading2) && (
        <div className="flex items-center justify-center py-12">
          <span className="font-mono text-slate-500 animate-pulse text-sm">{tr.loading}</span>
        </div>
      )}
    </div>
  )
}
