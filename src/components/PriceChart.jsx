export default function PriceChart({ prices, ticker }) {
  if (!prices || prices.length < 2) return null

  const W = 600, H = 160, PAD = 24
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const pts = prices.map((p, i) => {
    const x = PAD + (i / (prices.length - 1)) * (W - PAD * 2)
    const y = PAD + (1 - (p - min) / range) * (H - PAD * 2)
    return [x, y]
  })

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `M ${pts[0][0]},${H - PAD} ` +
    pts.map(([x, y]) => `L ${x},${y}`).join(' ') +
    ` L ${pts[pts.length - 1][0]},${H - PAD} Z`

  const lastPrice = prices[prices.length - 1]
  const firstPrice = prices[0]
  const up = lastPrice >= firstPrice
  const lineColor = up ? '#22c55e' : '#ef4444'
  const fillColor = up ? '#22c55e18' : '#ef444418'

  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now = new Date()
  const labels = prices.map((_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - (prices.length - 1 - i))
    return monthLabels[d.getMonth()]
  })

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#chartGrad)" />
        <polyline points={polyline} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinejoin="round" />
        {pts.map(([x, y], i) => i % 2 === 0 && (
          <text key={i} x={x} y={H + 14} textAnchor="middle"
            fill="#64748b" style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}>
            {labels[i]}
          </text>
        ))}
        <text x={pts[pts.length - 1][0]} y={pts[pts.length - 1][1] - 6}
          textAnchor="end" fill={lineColor} style={{ fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
          ${lastPrice}
        </text>
      </svg>
    </div>
  )
}
