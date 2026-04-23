// ============================================================
// RiskGauge
// Gauge SVG de 0–100. Responsivo con viewBox + width: 100%.
// El tamaño se adapta al contenedor sin overflow.
// ============================================================
export default function RiskGauge({ score, tr }) {
  const clamped = Math.min(100, Math.max(0, score ?? 50))
  const angle = -135 + (clamped / 100) * 270

  const color = clamped <= 33 ? '#22c55e' : clamped <= 66 ? '#f59e0b' : '#ef4444'
  const label = clamped <= 33 ? tr.low : clamped <= 66 ? tr.moderate : tr.high

  const cx = 100, cy = 100, r = 70
  const toRad = d => (d * Math.PI) / 180

  function arc(start, end, strokeColor, strokeW = 8) {
    const s = toRad(start), e = toRad(end)
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e)
    const large = end - start > 180 ? 1 : 0
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        fill="none" stroke={strokeColor} strokeWidth={strokeW}
        strokeLinecap="round"
      />
    )
  }

  const needleRad = toRad(angle)
  const nx = cx + (r - 10) * Math.cos(needleRad)
  const ny = cy + (r - 10) * Math.sin(needleRad)

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      {/* max-w controla el tamaño máximo; en mobile se achica solo */}
      <svg
        viewBox="0 0 200 155"
        className="w-full max-w-[180px]"
        aria-label={`Risk score: ${clamped} — ${label}`}
        role="img"
      >
        {arc(-135, -45, '#22c55e4d')}
        {arc(-45,  45,  '#f59e0b4d')}
        {arc(45,   135, '#ef44444d')}
        {arc(-135, angle, color)}
        <line
          x1={cx} y1={cy}
          x2={nx} y2={ny}
          stroke={color} strokeWidth={3} strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={5} fill={color} />
        <text
          x={cx} y={cy + 28}
          textAnchor="middle"
          fill="white"
          style={{ fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}
        >
          {clamped}
        </text>
      </svg>
      <span
        className="font-mono text-xs font-bold tracking-widest text-center"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  )
}
