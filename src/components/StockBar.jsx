// ============================================================
// StockBar
// Barra horizontal de KPIs del ticker activo.
// En mobile: scroll horizontal con snap para que todos los items
// sean accesibles sin romper el layout. No oculta datos críticos.
// ============================================================
export default function StockBar({ data, tr }) {
  if (!data) return null
  const up = (data.changePct ?? 0) >= 0
  const changeColor = up ? 'text-green-400' : 'text-red-400'

  const items = [
    { label: tr.price,     value: `$${data.price}`,                              color: 'text-white' },
    { label: tr.change,    value: `${up ? '+' : ''}${data.change} (${up ? '+' : ''}${data.changePct}%)`, color: changeColor },
    { label: tr.volume,    value: data.volume,                                   color: 'text-slate-300' },
    { label: tr.marketCap, value: data.marketCap,                                color: 'text-slate-300' },
    { label: tr.week52High,value: `$${data.week52High}`,                         color: 'text-slate-300' },
    { label: tr.week52Low, value: `$${data.week52Low}`,                          color: 'text-slate-300' },
  ]

  return (
    <div className="bg-[#0f1117] border-b border-[#1e2130]">
      {/*
        overflow-x-auto con scroll-snap: el usuario puede scrollear
        horizontalmente en mobile para ver todos los KPIs.
        No usamos wrap porque los items se verían desalineados.
      */}
      <div
        className="flex gap-0 overflow-x-auto px-4 py-2.5 scrollbar-none"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {items.map(({ label, value, color }) => (
          <div
            key={label}
            className="flex flex-col shrink-0 pr-5"
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
  )
}
