function statusColor(status) {
  if (status === 'beats') return 'text-green-400 border-green-400/30 bg-green-400/5'
  if (status === 'misses') return 'text-red-400 border-red-400/30 bg-red-400/5'
  return 'text-amber-400 border-amber-400/30 bg-amber-400/5'
}

function autoStatus(value, key) {
  if (value == null) return 'caution'
  const v = parseFloat(value)
  if (isNaN(v)) return 'caution'
  const goodHigh = ['currentRatio','interestCov','revenueGrowth','epsGrowth','marginTrend','returnEquity','freeCashFlow']
  const goodLow  = ['pe','pb','ps','ev_ebitda','debtEq']
  if (goodHigh.includes(key)) return v > 0 ? 'beats' : 'misses'
  if (goodLow.includes(key)) return v < 25 ? 'beats' : v < 50 ? 'caution' : 'misses'
  return 'caution'
}

export default function MetricCard({ label, value, metricKey, status: forcedStatus, tr }) {
  const status = forcedStatus || autoStatus(value, metricKey)
  const cls = statusColor(status)
  const badge = tr[status] || status.toUpperCase()

  return (
    <div className={`border rounded-lg p-3 flex flex-col gap-1.5 ${cls}`}>
      <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400">{label}</span>
      <span className="font-mono text-lg font-bold text-white">
        {value != null ? value : '—'}
        {typeof value === 'number' && metricKey?.includes('Growth') || metricKey?.includes('margin') ? '%' : ''}
      </span>
      <span className={`text-[10px] font-mono font-bold tracking-widest ${cls.split(' ')[0]}`}>{badge}</span>
    </div>
  )
}
