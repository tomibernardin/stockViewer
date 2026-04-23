// ============================================================
// RiskGauge
// Gauge tipo velocímetro: apertura en la parte inferior,
// aguja barre de inferior-izquierda (score 0) sobre el tope
// hasta inferior-derecha (score 100).
//
// Ángulos SVG (y crece hacia abajo):
//   135° = inferior-izquierda (inicio, score=0)
//   270° = tope / 12 en punto (score=50)
//   405° = 45° = inferior-derecha (fin, score=100)
//   Barrido: clockwise (sweep-flag=1), 270° totales.
//
// ViewBox calculado para que el arco y el texto quepan siempre:
//   cx=100, cy=88, r=68 → tope del arco en y=20, base en y≈136
// ============================================================
const CX = 100, CY = 88, R = 68

const toRad = d => (d * Math.PI) / 180

// Calcula el punto en la circunferencia para un ángulo en grados
function pt(deg) {
  return {
    x: CX + R * Math.cos(toRad(deg)),
    y: CY + R * Math.sin(toRad(deg)),
  }
}

// Dibuja un arco clockwise de startDeg a endDeg
function arcPath(startDeg, endDeg, strokeColor, strokeW = 8) {
  const p1 = pt(startDeg)
  const p2 = pt(endDeg)
  // Span clockwise: si endDeg < startDeg, dar vuelta completa
  let span = endDeg - startDeg
  if (span <= 0) span += 360
  const large = span > 180 ? 1 : 0
  return (
    <path
      d={`M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`}
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeW}
      strokeLinecap="round"
    />
  )
}

export default function RiskGauge({ score, tr }) {
  const clamped = Math.min(100, Math.max(0, score ?? 50))

  const color = clamped <= 33 ? '#22c55e' : clamped <= 66 ? '#f59e0b' : '#ef4444'
  const label = clamped <= 33 ? tr.low : clamped <= 66 ? tr.moderate : tr.high

  // Ángulo de la aguja: 135° (score=0) → 405° (score=100)
  const needleDeg = 135 + (clamped / 100) * 270
  const needlePt  = {
    x: CX + (R - 12) * Math.cos(toRad(needleDeg)),
    y: CY + (R - 12) * Math.sin(toRad(needleDeg)),
  }

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <svg
        viewBox="22 12 156 138"
        className="w-full max-w-[200px]"
        aria-label={`Risk score: ${clamped} — ${label}`}
        role="img"
      >
        {/* Zonas de fondo (dim) */}
        {arcPath(135, 225, '#22c55e33')}
        {arcPath(225, 315, '#f59e0b33')}
        {arcPath(315, 405, '#ef444433')}

        {/* Arco de progreso coloreado */}
        {clamped > 0 && arcPath(135, 135 + (clamped / 100) * 270, color)}

        {/* Aguja */}
        <line
          x1={CX} y1={CY}
          x2={needlePt.x.toFixed(3)} y2={needlePt.y.toFixed(3)}
          stroke={color} strokeWidth={2.5} strokeLinecap="round"
        />
        {/* Centro de la aguja */}
        <circle cx={CX} cy={CY} r={4} fill={color} />

        {/* Score numérico — centrado visualmente bajo el pivote */}
        <text
          x={CX} y={CY + 24}
          textAnchor="middle"
          fill="white"
          style={{ fontSize: 26, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}
        >
          {clamped}
        </text>
      </svg>

      <span
        className="font-mono text-[10px] font-bold tracking-widest text-center uppercase"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  )
}
