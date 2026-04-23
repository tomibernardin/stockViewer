export default function StockBar({ data, tr }) {
  if (!data) return null
  const up = data.changePct >= 0
  const color = up ? 'text-green-400' : 'text-red-400'

  const items = [
    { label: tr.price,    value: `$${data.price}` },
    { label: tr.change,   value: `${up ? '+' : ''}${data.change} (${up ? '+' : ''}${data.changePct}%)`, color },
    { label: tr.volume,   value: data.volume },
    { label: tr.marketCap,value: data.marketCap },
    { label: tr.week52High,value: `$${data.week52High}` },
    { label: tr.week52Low, value: `$${data.week52Low}` },
  ]

  return (
    <div className="bg-[#0f1117] border-b border-[#1e2130] px-4 py-2 overflow-x-auto">
      <div className="max-w-5xl mx-auto flex gap-6 min-w-max">
        {items.map(({ label, value, color: c }) => (
          <div key={label} className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">{label}</span>
            <span className={`font-mono text-sm font-semibold ${c || 'text-white'}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
