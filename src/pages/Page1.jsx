// ============================================================
// Page1 — Overview
// Mobile-first: todos los layouts stacked en mobile, side-by-side en sm+.
// Gauge ocupa ancho completo en mobile con KPIs debajo en grid 2-col.
// Grids de métricas: 2-col en mobile (legible), 4-col en sm+.
// ============================================================
import RiskGauge from '../components/RiskGauge'
import PriceChart from '../components/PriceChart'
import MetricCard from '../components/MetricCard'
import ScoreBar from '../components/ScoreBar'

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 border-b border-[#1e2130] pb-1.5">
        {title}
      </h2>
      {children}
    </section>
  )
}

function KpiChip({ label, value }) {
  return (
    <div className="bg-[#0f1117] border border-[#1e2130] rounded-lg p-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 leading-tight">
        {label}
      </span>
      <span className="font-mono text-sm font-bold text-white leading-tight">
        {value ?? '—'}
      </span>
    </div>
  )
}

export default function Page1({ data, tr }) {
  if (!data) return null

  const { valuation, financial, growth, scores, chartPrices, ticker, score } = data

  const weightedScore = Math.round(
    scores.valuation * 0.35 + scores.financial * 0.35 + scores.growth * 0.30
  )

  return (
    <div className="flex flex-col gap-5">

      {/* ── Gauge + KPI strip ─────────────────────────────────
          Mobile: gauge centrado arriba, KPIs en grid 2-col debajo.
          sm+: gauge a la izquierda, KPIs a la derecha en 3-col.
      ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Gauge */}
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 flex flex-col items-center gap-2 sm:min-w-[180px] sm:max-w-[200px]">
          <span className="text-[10px] font-mono uppercase text-slate-500 tracking-widest">
            {tr.riskScore}
          </span>
          <RiskGauge score={score} tr={tr} />
        </div>

        {/* KPI chips — 2-col mobile, 3-col sm */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 flex-1">
          <KpiChip label={tr.pe}          value={valuation.pe} />
          <KpiChip label={tr.pb}          value={valuation.pb} />
          <KpiChip label={tr.ps}          value={valuation.ps} />
          <KpiChip label={tr.ev_ebitda}   value={valuation.ev_ebitda} />
          <KpiChip label={tr.debtEq}      value={financial.debtEq} />
          <KpiChip label={tr.freeCashFlow} value={financial.freeCashFlow} />
        </div>
      </div>

      {/* ── Price Chart ────────────────────────────────────── */}
      <Section title={`${ticker} — 12M`}>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-3 sm:p-4">
          <PriceChart prices={chartPrices} ticker={ticker} />
        </div>
      </Section>

      {/* ── Valuation Grid — 2-col mobile, 4-col sm ───────── */}
      <Section title={tr.valuation}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MetricCard label={tr.pe}        value={valuation.pe}        metricKey="pe"        tr={tr} />
          <MetricCard label={tr.pb}        value={valuation.pb}        metricKey="pb"        tr={tr} />
          <MetricCard label={tr.ps}        value={valuation.ps}        metricKey="ps"        tr={tr} />
          <MetricCard label={tr.ev_ebitda} value={valuation.ev_ebitda} metricKey="ev_ebitda" tr={tr} />
        </div>
      </Section>

      {/* ── Financial Health Grid ─────────────────────────── */}
      <Section title={tr.financialHealth}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MetricCard label={tr.debtEq}       value={financial.debtEq}      metricKey="debtEq"      tr={tr} />
          <MetricCard label={tr.currentRatio}  value={financial.currentRatio} metricKey="currentRatio" tr={tr} />
          <MetricCard label={tr.interestCov}   value={financial.interestCov}  metricKey="interestCov"  tr={tr} />
          <MetricCard label={tr.freeCashFlow}  value={financial.freeCashFlow} metricKey="freeCashFlow" tr={tr} />
        </div>
      </Section>

      {/* ── Growth Grid ───────────────────────────────────── */}
      <Section title={tr.growth}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MetricCard label={tr.revenueGrowth} value={growth.revenueGrowth} metricKey="revenueGrowth" tr={tr} />
          <MetricCard label={tr.epsGrowth}     value={growth.epsGrowth}     metricKey="epsGrowth"     tr={tr} />
          <MetricCard label={tr.marginTrend}   value={growth.marginTrend}   metricKey="marginTrend"   tr={tr} />
          <MetricCard label={tr.returnEquity}  value={growth.returnEquity}  metricKey="returnEquity"  tr={tr} />
        </div>
      </Section>

      {/* ── Score Breakdown ───────────────────────────────── */}
      <Section title={tr.score}>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 sm:p-5 flex flex-col gap-4">
          <ScoreBar label={tr.valuation}      score={scores.valuation} weight={35} />
          <ScoreBar label={tr.financialHealth} score={scores.financial} weight={35} />
          <ScoreBar label={tr.growth}          score={scores.growth}    weight={30} />
          <div className="border-t border-[#1e2130] pt-3 flex justify-between items-baseline">
            <span className="text-xs font-mono text-slate-400">Weighted Score</span>
            <span className="font-mono font-bold text-white text-xl">{weightedScore}<span className="text-slate-500 text-sm"> / 100</span></span>
          </div>
        </div>
      </Section>
    </div>
  )
}
