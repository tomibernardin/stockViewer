// ============================================================
// Page2 — Deep Dive
// Mobile-first: tabla con scroll horizontal, columnas duales
// que stackean en mobile (Catalysts/Risks, Earnings/Delivery).
// Los badges de status tienen texto truncado en mobile para no overflow.
// ============================================================

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

function StatusBadge({ status, tr }) {
  if (status === 'beats')  return <span className="text-[10px] font-mono font-bold text-green-400 whitespace-nowrap">▲ {tr.beats}</span>
  if (status === 'misses') return <span className="text-[10px] font-mono font-bold text-red-400   whitespace-nowrap">▼ {tr.misses}</span>
  return                          <span className="text-[10px] font-mono font-bold text-amber-400 whitespace-nowrap">● {tr.caution}</span>
}

function ratingConfig(score, tr) {
  if (score >= 67) return { bar: 'bg-green-500', text: 'text-green-400', label: tr.bullish }
  if (score >= 34) return { bar: 'bg-amber-500', text: 'text-amber-400', label: tr.neutral }
  return                  { bar: 'bg-red-500',   text: 'text-red-400',   label: tr.bearish }
}

function buildVerdict(data, tr, lang) {
  const score  = data.score ?? 50
  const ticker = data.ticker
  const up     = (data.changePct ?? 0) >= 0
  if (lang === 'es') {
    const nivel = score >= 67 ? 'bajo' : score >= 34 ? 'moderado' : 'alto'
    const sent  = up ? 'impulso positivo reciente' : 'presión reciente sobre el precio'
    return `${ticker} presenta un perfil de riesgo ${nivel} con una puntuación compuesta de ${score}/100. El análisis muestra ${sent}. Los inversores deben evaluar la valuación y las tendencias de crecimiento antes de tomar decisiones. Esta información es solo con fines educativos.`
  }
  const level = score >= 67 ? 'low' : score >= 34 ? 'moderate' : 'high'
  const sent  = up ? 'positive recent momentum' : 'recent price pressure'
  return `${ticker} presents a ${level}-risk profile with a composite score of ${score}/100. Analysis shows ${sent}. Investors should weigh valuation and growth trends before positioning. This information is for educational purposes only.`
}

// ── Formatea un item de earningsRaw usando tr ─────────────────
function fmtEarning(item, tr) {
  if (item.type === 'eps')
    return `${item.quarter}: EPS $${item.eps} vs est $${item.epsEst} — ${item.beat ? tr.beat : tr.miss}`
  if (item.type === 'revenue')
    return `${item.quarter}: ${tr.revenue} ${item.revenue} — ${tr.inlineWithEst}`
  return ''
}

// ── Formatea un item de deliveryRaw usando tr ─────────────────
function fmtDelivery(item, tr) {
  if (item.type === 'units')
    return `FY${item.year} ${tr.unitsLabel}: ${item.units} (+${item.growth}% YoY)`
  if (item.type === 'guidance')
    return `${tr.guidanceFor}${item.year}`
  return ''
}

export default function Page2({ data, tr, lang }) {
  if (!data) return null

  const { quarterlyData, earningsRaw, deliveryRaw, score } = data
  const rc      = ratingConfig(score, tr)
  const verdict = buildVerdict(data, tr, lang)

  return (
    <div className="flex flex-col gap-5">

      {/* ── Quarterly Trends ─────────────────────────────────
          La tabla se wrappea en overflow-x-auto para que en mobile
          sea scrolleable horizontalmente sin romper el layout.
      ──────────────────────────────────────────────────────── */}
      <Section title={tr.quarterly}>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden">
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm font-mono min-w-[400px]">
              <thead>
                <tr className="border-b border-[#1e2130] text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="text-left px-4 py-2.5 whitespace-nowrap">{tr.quarter}</th>
                  <th className="text-right px-4 py-2.5 whitespace-nowrap">{tr.revenue}</th>
                  <th className="text-right px-4 py-2.5 whitespace-nowrap">{tr.eps}</th>
                  <th className="text-right px-4 py-2.5 whitespace-nowrap">{tr.margin}</th>
                  <th className="text-right px-4 py-2.5 whitespace-nowrap">EPS</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyData.map((q, i) => (
                  <tr
                    key={i}
                    className="border-b border-[#1e2130]/50 last:border-0 hover:bg-[#1e2130]/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{q.quarter}</td>
                    <td className="px-4 py-3 text-right text-white whitespace-nowrap">{q.revenue}</td>
                    <td className="px-4 py-3 text-right text-white whitespace-nowrap">{q.eps ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-400 whitespace-nowrap">
                      {q.margin != null ? `${q.margin}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <StatusBadge status={q.epsStatus} tr={tr} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ── Earnings + Delivery — stack en mobile, side-by-side en sm ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Section title={tr.earnings}>
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 flex flex-col gap-2.5">
            {(earningsRaw ?? []).map((item, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-blue-500 shrink-0 mt-0.5 select-none">›</span>
                <span className="text-slate-300 font-mono text-xs leading-relaxed">{fmtEarning(item, tr)}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title={tr.deliveries}>
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 flex flex-col gap-2.5">
            {(deliveryRaw ?? []).map((item, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-blue-500 shrink-0 mt-0.5 select-none">›</span>
                <span className="text-slate-300 font-mono text-xs leading-relaxed">{fmtDelivery(item, tr)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Catalysts vs Risks — stack en mobile, side-by-side en sm ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Section title={tr.catalysts}>
          <div className="bg-[#0f1117] border border-green-400/20 rounded-xl p-4 flex flex-col gap-2.5">
            {tr.catalystsList.map((c, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-green-400 shrink-0 font-mono select-none">+</span>
                <span className="text-slate-300 font-sans text-sm leading-relaxed">{c}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title={tr.risks}>
          <div className="bg-[#0f1117] border border-red-400/20 rounded-xl p-4 flex flex-col gap-2.5">
            {tr.risksList.map((r, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-red-400 shrink-0 font-mono select-none">−</span>
                <span className="text-slate-300 font-sans text-sm leading-relaxed">{r}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Bottom Line ───────────────────────────────────── */}
      <Section title={tr.bottomLine}>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 sm:p-5 flex flex-col gap-4">
          {/* Rating bar */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-500 uppercase tracking-wider">{tr.rating}</span>
              <span className={`font-bold tracking-widest ${rc.text}`}>{rc.label}</span>
            </div>
            <div className="h-2 bg-[#1e2130] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${rc.bar}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          {/* Verdict */}
          <div className="border-t border-[#1e2130] pt-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
              {tr.verdict}
            </p>
            {/* font-size 15px en mobile — legible sin zoom, ≥16px no necesario en párrafo */}
            <p className="font-sans text-slate-300 leading-relaxed" style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}>
              {verdict}
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}
