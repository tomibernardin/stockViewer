# StockViewer

A responsive, mobile-first stock risk analysis app built with React + Tailwind CSS. Fetches real-time data from Yahoo Finance and presents a two-page risk report with scoring, charts, and fundamentals.

## Features

- **Real-time data** — Live prices and fundamentals from Yahoo Finance (auto-refreshes every 60 seconds)
- **Risk Score gauge** — Weighted composite score (valuation 35% + financial health 35% + growth 30%)
- **Two-page report**
  - Page 1: Risk gauge, price chart, KPI strip, valuation/financial/growth metric cards
  - Page 2: Quarterly earnings table, catalysts & risks, earnings/delivery updates
- **35 tickers** — AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, AVGO, AMD, INTC, CRM, ORCL, NFLX, DIS, PYPL, SQ, COIN, HOOD, JPM, GS, BAC, WMT, COST, HD, NKE, PFE, JNJ, LLY, XOM, CVX, BA, CAT, DE, ENPH, NEE
- **EN / ES i18n** — Full bilingual UI (English / Spanish)
- **Graceful fallback** — Deterministic seed-based data when live API is unavailable (no random flickering)
- **Copy to clipboard** — Export the full text report with one tap
- **Mobile-first** — Designed for iPhone/Android, scales up to desktop

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + Vite 4 |
| Styling | Tailwind CSS 3, JetBrains Mono, DM Sans |
| Data | Yahoo Finance (chart + quoteSummary APIs) |
| Dev proxy | Vite `configureServer` middleware |
| Prod proxy | Vercel Serverless Function (`api/quote.js`) |
| Deployment | Vercel |

## Architecture

### API Proxy

Yahoo Finance requires a **crumb token** for fundamentals and blocks direct browser requests (CORS). The app routes all requests through a server-side proxy:

```
Browser → /api/quote?symbol=AAPL
           │
           ├─ [dev]  Vite middleware (vite.config.js)
           └─ [prod] Vercel Serverless Function (api/quote.js)
                      │
                      ├─ GET finance.yahoo.com     → session cookies
                      ├─ GET /v1/test/getcrumb     → crumb token (cached 25 min)
                      ├─ GET chart API             → price, volume, 52W, history (cached 45s)
                      └─ GET quoteSummary API      → PE, PB, fundamentals (cached 5 min)
```

**Degradation modes:**
- ✅ Full data: live price + real fundamentals (crumb valid)
- 🔵 Partial: live price + estimated fundamentals (crumb unavailable)
- ⚠️ Simulated: deterministic seed-based fallback (API unreachable)

### Data Flow

```
useStockData(ticker)
  ├─ Initial load → setLoading(true) → fetchLive() → setData()
  ├─ Silent refresh every 60s → fetchLive() (no spinner)
  └─ Returns { data, loading, error, lastUpdate, reload }
```

### Scoring

```
Risk Score = clamp(0–100):
  50
  - debtToEquity × 2
  + revenueGrowth × 30
  + returnOnEquity × 10
  - max(0, trailingPE - 20) × 0.5
```

Sub-scores (valuation / financial / growth) use deterministic seed values; the composite score uses live fundamentals when available.

## Project Structure

```
StockViewer/
├── api/
│   └── quote.js          # Vercel serverless function (Yahoo Finance proxy)
├── src/
│   ├── components/
│   │   ├── Header.jsx    # Ticker select, page tabs, language toggle
│   │   ├── StockBar.jsx  # Scrollable KPI strip (price, change, vol, cap, 52W)
│   │   ├── RiskGauge.jsx # SVG speedometer gauge (135°→405° clockwise)
│   │   ├── ScoreBar.jsx  # Weighted score bar with label, weight, value
│   │   ├── MetricCard.jsx# Metric tile (label + value)
│   │   └── PriceChart.jsx# 12-month price sparkline (SVG)
│   ├── pages/
│   │   ├── Page1.jsx     # Overview: gauge, chart, KPIs, metric grids
│   │   └── Page2.jsx     # Detail: quarterly table, catalysts, risks
│   ├── App.jsx           # Shell: state, layout, copy-report, footer
│   ├── useStockData.js   # Data hook: fetch, cache, auto-refresh, fallback
│   ├── i18n.js           # EN/ES translation strings
│   ├── tickers.js        # 35 supported tickers list
│   └── index.css         # Tailwind base + custom scrollbar utilities
├── vite.config.js        # Vite config + dev API middleware
├── vercel.json           # Vercel routing (rewrites /api/* → serverless)
├── tailwind.config.js
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 16+ (18+ recommended)
- npm 8+

### Install & Run

```bash
# Clone
git clone https://github.com/tomibernardin/stockViewer.git
cd stockViewer

# Install dependencies
npm install

# Start dev server (includes Yahoo Finance proxy)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The dev server pre-warms the Yahoo Finance crumb session on startup. Watch the console for `[yahoo] crumb: "..." | valid=true`.

### Build for Production

```bash
npm run build
npm run preview
```

## Deployment (Vercel)

1. Push to GitHub (the repo is already connected)
2. Vercel auto-deploys on every push to `master`
3. The `api/quote.js` serverless function is picked up automatically
4. No environment variables required — the proxy handles auth internally

**Vercel settings:**
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Node.js version: 18.x (required for `fetch` + `headers.getSetCookie()`)

## Mobile UX Notes

- Font size 16px on all inputs/selects (prevents iOS auto-zoom)
- Minimum touch target `44px` on all interactive elements (Apple/WCAG guideline)
- Horizontal scroll with scroll-snap on the KPI strip
- `scrollbar-none` utility for clean mobile scrollbars

## License

MIT
