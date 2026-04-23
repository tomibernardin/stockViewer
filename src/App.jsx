import { useState, useCallback } from 'react'
import Header from './components/Header'
import StockBar from './components/StockBar'
import Page1 from './pages/Page1'
import Page2 from './pages/Page2'
import { useStockData } from './useStockData'
import { t } from './i18n'

function buildReportText(data, tr) {
  if (!data) return ''
  const lines = [
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
  ]
  return lines.join('\n')
}

export default function App() {
  const [ticker, setTicker] = useState('AAPL')
  const [lang, setLang] = useState('en')
  const [page, setPage] = useState(1)
  const [copied, setCopied] = useState(false)
  const tr = t[lang]

  const { data, loading, error } = useStockData(ticker)

  const copyReport = useCallback(async () => {
    const text = buildReportText(data, tr)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [data, tr])

  return (
    <div className="min-h-screen bg-[#08090d] text-white font-sans">
      <Header
        ticker={ticker} setTicker={setTicker}
        lang={lang} setLang={setLang}
        page={page} setPage={setPage}
        tr={tr}
      />

      {data && <StockBar data={data} tr={tr} />}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <span className="font-mono text-slate-500 animate-pulse">{tr.loading}</span>
          </div>
        )}

        {!loading && (
          <>
            {error && (
              <div className="mb-4 px-3 py-2 bg-amber-400/10 border border-amber-400/30 rounded text-xs font-mono text-amber-400">
                ⚠ Live data unavailable — showing simulated data for {ticker}
              </div>
            )}

            {page === 1 && <Page1 data={data} tr={tr} />}
            {page === 2 && <Page2 data={data} tr={tr} lang={lang} />}

            {/* Footer */}
            <div className="mt-8 flex items-center justify-between border-t border-[#1e2130] pt-4">
              <span className="text-[10px] font-mono text-slate-600">
                {tr.page} {page} {tr.of} 2 · {ticker} · {new Date().toLocaleDateString()}
              </span>
              <button
                onClick={copyReport}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#0f1117] border border-[#1e2130] rounded text-xs font-mono text-slate-400 hover:text-white hover:border-blue-500 transition-colors"
              >
                {copied ? `✓ ${tr.copied}` : `⎘ ${tr.copyReport}`}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
