import { TICKERS, TICKER_GROUPS } from '../tickers'

export default function Header({ ticker, setTicker, lang, setLang, page, setPage, tr }) {
  const grouped = TICKER_GROUPS.map(g => ({
    ...g,
    items: TICKERS.filter(t => g.types.includes(t.type)),
  }))

  return (
    <header className="sticky top-0 z-50 bg-[#08090d] border-b border-[#1e2130] px-4 py-3">
      <div className="max-w-5xl mx-auto flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-white text-lg tracking-tight">StockViewer</span>
          <select
            value={ticker}
            onChange={e => setTicker(e.target.value)}
            className="bg-[#0f1117] border border-[#1e2130] text-white font-mono text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          >
            {grouped.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map(t => (
                  <option key={t.symbol} value={t.symbol}>{t.symbol} — {t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <nav className="flex rounded overflow-hidden border border-[#1e2130] text-xs font-mono">
            <button
              onClick={() => setPage(1)}
              className={`px-3 py-1.5 transition-colors ${page === 1 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-[#1e2130]'}`}
            >
              {tr.overview}
            </button>
            <button
              onClick={() => setPage(2)}
              className={`px-3 py-1.5 border-l border-[#1e2130] transition-colors ${page === 2 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-[#1e2130]'}`}
            >
              {tr.deepDive}
            </button>
          </nav>

          <button
            onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}
            className="border border-[#1e2130] text-slate-300 font-mono text-xs px-2 py-1.5 rounded hover:border-blue-500 hover:text-white transition-colors"
          >
            {lang === 'en' ? 'ES' : 'EN'}
          </button>
        </div>
      </div>
    </header>
  )
}
