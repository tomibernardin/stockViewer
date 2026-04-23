// ============================================================
// ScoreBar
// Barra de score con label, peso y número.
// Mobile: label arriba izquierda, score arriba derecha — sin overflow.
// El color de la barra y el número cambia según el score.
// ============================================================
function barColor(score) {
  if (score >= 67) return { bar: 'bg-green-500', text: 'text-green-400' }
  if (score >= 34) return { bar: 'bg-amber-500', text: 'text-amber-400' }
  return                  { bar: 'bg-red-500',   text: 'text-red-400' }
}

export default function ScoreBar({ label, score, weight }) {
  const clamped = Math.min(100, Math.max(0, score ?? 0))
  const { bar, text } = barColor(clamped)

  return (
    <div className="flex flex-col gap-1.5">
      {/* Fila superior: label izquierda, score derecha */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-xs text-slate-300 truncate">{label}</span>
          <span className="font-mono text-[10px] text-slate-600 shrink-0">×{weight}%</span>
        </div>
        <span className={`font-mono text-sm font-bold shrink-0 ${text}`}>
          {clamped}<span className="text-slate-600 font-normal text-[10px]">/100</span>
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 bg-[#1e2130] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${bar}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
