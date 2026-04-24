// ============================================================
// Header
// Navegación principal sticky con selector de ticker, tabs y lang toggle.
// Mobile-first: en <640px apila en dos filas para evitar overflow.
// El select tiene font-size 16px para evitar zoom automático en iOS.
// ============================================================
import { TICKERS, TICKER_GROUPS } from '../tickers'

function TickerSelect({ value, onChange, label }) {
  const grouped = TICKER_GROUPS.map(g => ({
    ...g,
    items: TICKERS.filter(t => g.types.includes(t.type)),
  }))

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={label}
      className="w-full bg-[#0f1117] border border-[#1e2130] text-white font-mono rounded px-3 py-2 focus:outline-none focus:border-blue-500 truncate"
      style={{ fontSize: '16px' }}
    >
      {grouped.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map(t => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol} — {t.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export default function Header({
  ticker, setTicker,
  ticker2, setTicker2,
  lang, setLang,
  page, setPage,
  tr,
}) {
  return (
    <header className="sticky top-0 z-50 bg-[#08090d] border-b border-[#1e2130]">
      {/* Fila 1: logo + lang toggle */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-3">
        <span className="font-mono font-bold text-white text-base tracking-tight shrink-0">
          StockViewer
        </span>

        <div className="flex items-center gap-2">
          {/* Tabs de página */}
          <nav className="flex rounded overflow-hidden border border-[#1e2130] text-xs font-mono">
            <button
              onClick={() => setPage(1)}
              className={`px-3 min-h-[36px] transition-colors ${
                page === 1 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-[#1e2130]'
              }`}
              aria-pressed={page === 1}
            >
              {tr.overview}
            </button>
            <button
              onClick={() => setPage(2)}
              className={`px-3 min-h-[36px] border-l border-[#1e2130] transition-colors ${
                page === 2 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-[#1e2130]'
              }`}
              aria-pressed={page === 2}
            >
              {tr.deepDive}
            </button>
            <button
              onClick={() => setPage(3)}
              className={`px-3 min-h-[36px] border-l border-[#1e2130] transition-colors ${
                page === 3 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-[#1e2130]'
              }`}
              aria-pressed={page === 3}
            >
              {tr.compare}
            </button>
          </nav>

          <button
            onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}
            aria-label={`Switch to ${lang === 'en' ? 'Spanish' : 'English'}`}
            className="border border-[#1e2130] text-slate-300 font-mono text-xs px-2.5 min-h-[36px] rounded hover:border-blue-500 hover:text-white transition-colors shrink-0"
          >
            {lang === 'en' ? 'ES' : 'EN'}
          </button>
        </div>
      </div>

      {/* Fila 2: selector(es) de ticker */}
      <div className="px-4 pb-3">
        {page !== 3 ? (
          <TickerSelect value={ticker} onChange={setTicker} label="Select ticker" />
        ) : (
          /* En modo Compare: dos selects lado a lado */
          <div className="grid grid-cols-2 gap-2">
            <TickerSelect value={ticker}  onChange={setTicker}  label="Select first ticker" />
            <TickerSelect value={ticker2} onChange={setTicker2} label="Select second ticker" />
          </div>
        )}
      </div>
    </header>
  )
}
