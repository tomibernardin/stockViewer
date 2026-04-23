import RiskGauge from '../components/RiskGauge'
import PriceChart from '../components/PriceChart'
import MetricCard from '../components/MetricCard'
import ScoreBar from '../components/ScoreBar'

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-[#1e2130] pb-1">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function Page1({ data, tr }) {
  if (!data) return null

  const { valuation, financial, growth, scores, chartPrices, ticker, score } = data

  const weightedScore = Math.round(
    scores.valuation * 0.35 + scores.financial * 0.35 + scores.growth * 0.30
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Gauge + KPI strip */}
      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 flex flex-col items-center gap-2 min-w-[200px]">
          <span className="text-xs font-mono uppercase text-slate-500 tracking-widest">{tr.riskScore}</span>
          <RiskGauge score={score} tr={tr} />
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
          {[
            { label: tr.pe,         value: valuation.pe },
            { label: tr.pb,         value: valuation.pb },
            { label: tr.ps,         value: valuation.ps },
            { label: tr.ev_ebitda,  value: valuation.ev_ebitda },
            { label: tr.debtEq,     value: financial.debtEq },
            { label: tr.freeCashFlow, value: financial.freeCashFlow },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#0f1117] border border-[#1e2130] rounded-lg p-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500">{label}</span>
              <span className="font-mono text-base font-bold text-white">{value ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Price Chart */}
      <Section title={`${ticker} — 12M`}>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4">
          <PriceChart prices={chartPrices} ticker={ticker} />
        </div>
      </Section>

      {/* Valuation Grid */}
      <Section title={tr.valuation}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label={tr.pe}        value={valuation.pe}        metricKey="pe"        tr={tr} />
          <MetricCard label={tr.pb}        value={valuation.pb}        metricKey="pb"        tr={tr} />
          <MetricCard label={tr.ps}        value={valuation.ps}        metricKey="ps"        tr={tr} />
          <MetricCard label={tr.ev_ebitda} value={valuation.ev_ebitda} metricKey="ev_ebitda" tr={tr} />
        </div>
      </Section>

      {/* Financial Health Grid */}
      <Section title={tr.financialHealth}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label={tr.debtEq}      value={financial.debtEq}      metricKey="debtEq"      tr={tr} />
          <MetricCard label={tr.currentRatio} value={financial.currentRatio} metricKey="currentRatio" tr={tr} />
          <MetricCard label={tr.interestCov}  value={financial.interestCov}  metricKey="interestCov"  tr={tr} />
          <MetricCard label={tr.freeCashFlow} value={financial.freeCashFlow} metricKey="freeCashFlow" tr={tr} />
        </div>
      </Section>

      {/* Growth Grid */}
      <Section title={tr.growth}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label={tr.revenueGrowth} value={growth.revenueGrowth} metricKey="revenueGrowth" tr={tr} />
          <MetricCard label={tr.epsGrowth}      value={growth.epsGrowth}     metricKey="epsGrowth"     tr={tr} />
          <MetricCard label={tr.marginTrend}    value={growth.marginTrend}   metricKey="marginTrend"   tr={tr} />
          <MetricCard label={tr.returnEquity}   value={growth.returnEquity}  metricKey="returnEquity"  tr={tr} />
        </div>
      </Section>

      {/* Score Breakdown */}
      <Section title={tr.score}>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-5 flex flex-col gap-4">
          <ScoreBar label={tr.valuation}     score={scores.valuation} weight={35} />
          <ScoreBar label={tr.financialHealth} score={scores.financial} weight={35} />
          <ScoreBar label={tr.growth}        score={scores.growth}    weight={30} />
          <div className="border-t border-[#1e2130] pt-3">
            <div className="flex justify-between text-sm font-mono">
              <span className="text-slate-400">Weighted Score</span>
              <span className="text-white font-bold text-lg">{weightedScore} / 100</span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
