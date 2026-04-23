// ============================================================
// App — Shell principal
// Maneja ticker, lang, page y la acción de copy to clipboard.
// El padding horizontal es mobile-first: px-4 en mobile, px-6 en md.
// ============================================================
import { useState, useCallback } from 'react'
import Header from './components/Header'
import StockBar from './components/StockBar'
import Page1 from './pages/Page1'
import Page2 from './pages/Page2'
import { useStockData } from './useStockData'
import { t } from './i18n'

function buildReportText(data, tr) {
  if (!data) return ''
  return [
    `=== ${data.ticker} — ${tr.riskScore}: ${data.score}/100 ===`,
    `${tr.price}: $${data.price} | ${tr.change}: ${data.changePct}%`,
    `${tr.marketCap}: ${data.marketCap} | ${tr.volume}: ${data.volume}`,
    '',
    `--- ${tr.valuation} ---`,
    `${tr.pe}: ${data.valuation.pe} | ${tr.pb}: ${data.valuation.pb} | ${tr.ps}: ${data.valuation.ps} | ${tr.ev_ebitda}: ${data.valuation.ev_ebitda}`,
    '',
    `--- ${tr.financialHealth} ---`,
    `${tr.debtEq}: ${data.financial.debtEq} | ${tr.currentRatio}: ${data.financial.currentRatio} | ${tr.freeCashFlow}: ${data.financial.freeCashFlow}`,
    '',
    `--- ${tr.growth} ---`,
    `${tr.revenueGrowth}: ${data.growth.revenueGrowth}% | ${tr.epsGrowth}: ${data.growth.epsGrowth}% | ${tr.returnEquity}: ${data.growth.returnEquity}%`,
    '',
    `--- ${tr.catalysts} ---`,
    ...data.catalysts.map(c => `+ ${c}`),
    '',
    `--- ${tr.risks} ---`,
    ...data.risks.map(r => `- ${r}`),
  ].join('\n')
}

export default function App() {
  const [ticker, setTicker] = useState('AAPL')
  const [lang,   setLang]   = useState('en')
  const [page,   setPage]   = useState(1)
  const [copied, setCopied] = useState(false)
  const tr = t[lang]

  const { data, loading, error } = useStockData(ticker)

  const copyReport = useCallback(async () => {
    const text = buildReportText(data, tr)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback para browsers sin Clipboard API
      const el = Object.assign(document.createElement('textarea'), { value: text })
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [data, tr])

  return (
    <div className="min-h-screen bg-[#08090d] text-white font-sans">
      <Header
        ticker={ticker} setTicker={setTicker}
        lang={lang}     setLang={setLang}
        page={page}     setPage={setPage}
        tr={tr}
      />

      {data && <StockBar data={data} tr={tr} />}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <span className="font-mono text-slate-500 animate-pulse text-sm">{tr.loading}</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Banner de datos simulados */}
            {error && !data?.hasLivePrice && (
              <div className="mb-4 px-3 py-2.5 bg-amber-400/10 border border-amber-400/30 rounded-lg text-xs font-mono text-amber-400 leading-relaxed">
                ⚠ Live data unavailable — showing simulated data for {ticker}
              </div>
            )}
            {data?.hasLivePrice && data?.isFallback && (
              <div className="mb-4 px-3 py-2.5 bg-blue-400/10 border border-blue-400/30 rounded-lg text-xs font-mono text-blue-400 leading-relaxed">
                ℹ Live price data · Fundamentals are estimated
              </div>
            )}

            {page === 1 && <Page1 data={data} tr={tr} />}
            {page === 2 && <Page2 data={data} tr={tr} lang={lang} />}

            {/* ── Footer ──────────────────────────────────────
                En mobile el texto de página se achica para que quepa
                junto al botón de copy sin overflow.
            ──────────────────────────────────────────────────── */}
            <footer className="mt-8 flex items-center justify-between gap-3 border-t border-[#1e2130] pt-4">
              <span className="text-[10px] font-mono text-slate-600 truncate">
                {tr.page} {page} {tr.of} 2 · {ticker} · {new Date().toLocaleDateString()}
              </span>
              {/* min-h-[44px] = área táctil mínima recomendada por Apple/WCAG */}
              <button
                onClick={copyReport}
                aria-label={copied ? tr.copied : tr.copyReport}
                className="shrink-0 flex items-center gap-1.5 px-3 min-h-[44px] bg-[#0f1117] border border-[#1e2130] rounded-lg text-xs font-mono text-slate-400 hover:text-white hover:border-blue-500 active:scale-95 transition-all"
              >
                {copied ? `✓ ${tr.copied}` : `⎘ ${tr.copyReport}`}
              </button>
            </footer>
          </>
        )}
      </main>
    </div>
  )
}
