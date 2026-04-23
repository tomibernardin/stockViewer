// ============================================================
// StockBar
// Barra de KPIs del ticker activo.
// Se contiene dentro de los mismos márgenes que el resto de la app
// (max-w-5xl mx-auto px-4 sm:px-6), igual que el selector y el main.
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
    { label: tr.price,      value: data.price     != null ? `$${data.price}`     : '—', color: 'text-white' },
    { label: tr.change,     value: fmtChange(data.change, data.changePct, up),           color: changeColor },
    { label: tr.volume,     value: data.volume     ?? '—',                               color: 'text-slate-300' },
    { label: tr.marketCap,  value: data.marketCap  ?? '—',                               color: 'text-slate-300' },
    { label: tr.week52High, value: data.week52High != null ? `$${data.week52High}` : '—', color: 'text-slate-300' },
    { label: tr.week52Low,  value: data.week52Low  != null ? `$${data.week52Low}`  : '—', color: 'text-slate-300' },
  ]

  return (
    // Mismo ancho y márgenes laterales que <main> y el selector
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2">
      <div className="bg-[#0f1117] border border-[#1e2130] rounded-lg overflow-hidden">
        {/*
          overflow-x-auto en el wrapper sin padding.
          El padding va en el div interno w-max para que
          tanto el margen izquierdo como el derecho sean visibles.
        */}
        <div
          className="overflow-x-auto scrollbar-none"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex gap-5 py-2.5 px-4 w-max sm:w-full sm:justify-between">
            {items.map(({ label, value, color }) => (
              <div
                key={label}
                className="flex flex-col shrink-0"
                style={{ scrollSnapAlign: 'start' }}
              >
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono whitespace-nowrap">
                  {label}
                </span>
                <span className={`font-mono text-sm font-semibold whitespace-nowrap ${color}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
