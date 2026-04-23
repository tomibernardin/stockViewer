// ============================================================
// StockBar
// Barra de KPIs del ticker activo.
// Grid 3-col mobile / 6-col desktop — sin scroll horizontal,
// sin spacers, sin asimetrías. p-3 igual que el resto de los cards.
// ============================================================

function fmtChange(change, changePct, up) {
  const sign = up ? '+' : ''
  if (change != null && changePct != null) return `${sign}${change} (${sign}${changePct}%)`
  if (changePct != null)                  return `${sign}${changePct}%`
  if (change != null)                     return `${sign}${change}`
  return '—'
}

export default function StockBar({ data, tr }) {
  if (!data) return null
  const up          = (data.changePct ?? data.change ?? 0) >= 0
  const changeColor = up ? 'text-green-400' : 'text-red-400'

  const items = [
    { label: tr.price,      value: data.price     != null ? `$${data.price}`      : '—', color: 'text-white' },
    { label: tr.change,     value: fmtChange(data.change, data.changePct, up),            color: changeColor },
    { label: tr.volume,     value: data.volume     ?? '—',                                color: 'text-slate-300' },
    { label: tr.marketCap,  value: data.marketCap  ?? '—',                                color: 'text-slate-300' },
    { label: tr.week52High, value: data.week52High != null ? `$${data.week52High}` : '—', color: 'text-slate-300' },
    { label: tr.week52Low,  value: data.week52Low  != null ? `$${data.week52Low}`  : '—', color: 'text-slate-300' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2">
      {/* p-3 igual que KpiChip y MetricCard — márgenes internos idénticos en todos los lados */}
      <div className="bg-[#0f1117] border border-[#1e2130] rounded-lg p-3">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-3">
          {items.map(({ label, value, color }) => (
            <div key={label} className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono truncate">
                {label}
              </span>
              <span className={`font-mono text-sm font-semibold truncate ${color}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
