function barColor(score) {
  if (score >= 67) return 'bg-green-500'
  if (score >= 34) return 'bg-amber-500'
  return 'bg-red-500'
}

export default function ScoreBar({ label, score, weight }) {
  const clamped = Math.min(100, Math.max(0, score ?? 0))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-500">{weight}% weight · <span className="text-white font-bold">{clamped}</span>/100</span>
      </div>
      <div className="h-2 bg-[#1e2130] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
