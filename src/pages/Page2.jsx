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

function statusBadge(status) {
  if (status === 'beats') return <span className="text-[10px] font-mono font-bold text-green-400">▲ BEATS</span>
  if (status === 'misses') return <span className="text-[10px] font-mono font-bold text-red-400">▼ MISSES</span>
  return <span className="text-[10px] font-mono font-bold text-amber-400">● CAUTION</span>
}

function ratingColor(score) {
  if (score >= 67) return { bar: 'bg-green-500', text: 'text-green-400', label: 'BULLISH' }
  if (score >= 34) return { bar: 'bg-amber-500', text: 'text-amber-400', label: 'NEUTRAL' }
  return { bar: 'bg-red-500', text: 'text-red-400', label: 'BEARISH' }
}

function buildVerdict(data, lang) {
  const score = data.score ?? 50
  const ticker = data.ticker
  const up = (data.changePct ?? 0) >= 0
  if (lang === 'es') {
    const nivel = score >= 67 ? 'bajo' : score >= 34 ? 'moderado' : 'alto'
    const sent = up ? 'impulso positivo reciente' : 'presión reciente sobre el precio'
    return `${ticker} presenta un perfil de riesgo ${nivel} con una puntuación compuesta de ${score}/100. El análisis muestra ${sent}. Los inversores deben evaluar la valuación y las tendencias de crecimiento antes de tomar decisiones. Esta información es solo con fines educativos.`
  }
  const level = score >= 67 ? 'low' : score >= 34 ? 'moderate' : 'high'
  const sent = up ? 'positive recent momentum' : 'recent price pressure'
  return `${ticker} presents a ${level}-risk profile with a composite score of ${score}/100. Analysis shows ${sent}. Investors should weigh valuation and growth trends before positioning. This information is for educational purposes only.`
}

export default function Page2({ data, tr, lang }) {
  if (!data) return null

  const { quarterlyData, earningsUpdates, deliveryUpdates, catalysts, risks, score, ticker } = data
  const rc = ratingColor(score)
  const verdict = buildVerdict(data, lang)

  return (
    <div className="flex flex-col gap-6">
      {/* Quarterly Trends */}
      <Section title={tr.quarterly}>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-[#1e2130] text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left px-4 py-2">{tr.quarter}</th>
                <th className="text-right px-4 py-2">{tr.revenue}</th>
                <th className="text-right px-4 py-2">{tr.eps}</th>
                <th className="text-right px-4 py-2">{tr.margin}</th>
                <th className="text-right px-4 py-2">EPS</th>
              </tr>
            </thead>
            <tbody>
              {quarterlyData.map((q, i) => (
                <tr key={i} className="border-b border-[#1e2130]/50 hover:bg-[#1e2130]/30 transition-colors">
                  <td className="px-4 py-2.5 text-slate-300">{q.quarter}</td>
                  <td className="px-4 py-2.5 text-right text-white">{q.revenue}</td>
                  <td className="px-4 py-2.5 text-right text-white">{q.eps ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-slate-400">
                    {q.margin != null ? `${q.margin}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">{statusBadge(q.epsStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Earnings & Delivery Updates */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Section title={tr.earnings}>
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 flex flex-col gap-2">
            {earningsUpdates.map((u, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-blue-500 mt-0.5 shrink-0">›</span>
                <span className="text-slate-300 font-mono text-xs leading-relaxed">{u}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title={tr.deliveries}>
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 flex flex-col gap-2">
            {deliveryUpdates.map((u, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-blue-500 mt-0.5 shrink-0">›</span>
                <span className="text-slate-300 font-mono text-xs leading-relaxed">{u}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Catalysts vs Risks */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Section title={tr.catalysts}>
          <div className="bg-[#0f1117] border border-green-400/20 rounded-xl p-4 flex flex-col gap-2">
            {catalysts.map((c, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-green-400 shrink-0">+</span>
                <span className="text-slate-300 font-sans text-sm">{c}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title={tr.risks}>
          <div className="bg-[#0f1117] border border-red-400/20 rounded-xl p-4 flex flex-col gap-2">
            {risks.map((r, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-red-400 shrink-0">−</span>
                <span className="text-slate-300 font-sans text-sm">{r}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Bottom Line */}
      <Section title={tr.bottomLine}>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono text-slate-500">
              <span>{tr.rating}</span>
              <span className={`font-bold ${rc.text}`}>{rc.label}</span>
            </div>
            <div className="h-2 bg-[#1e2130] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${rc.bar}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
          <div className="border-t border-[#1e2130] pt-3">
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-2">{tr.verdict}</p>
            <p className="text-sm font-sans text-slate-300 leading-relaxed">{verdict}</p>
          </div>
        </div>
      </Section>
    </div>
  )
}
