const CHART_BENCHMARKS = Object.freeze({
  SPY: Object.freeze({
    ticker: 'SPY',
    yahoo_ticker: 'SPY',
    company_name: 'SPDR S&P 500 ETF Trust',
    sector: 'Broad Market ETF',
    industry: 'Index ETF',
    price_source: 'benchmark',
  }),
  QQQ: Object.freeze({
    ticker: 'QQQ',
    yahoo_ticker: 'QQQ',
    company_name: 'Invesco QQQ Trust',
    sector: 'Technology Growth ETF',
    industry: 'Index ETF',
    price_source: 'benchmark',
  }),
});

export const CHART_BENCHMARK_TICKERS = Object.freeze(Object.keys(CHART_BENCHMARKS));

function normalizeTicker(value) {
  const ticker = String(value ?? '').trim().toUpperCase();
  return ticker || null;
}

export function getChartBenchmarkDefinition(ticker) {
  return CHART_BENCHMARKS[normalizeTicker(ticker)] ?? null;
}

export function buildChartTickerOptions({ constituents = [], featuredTickers = [] } = {}) {
  const constituentByTicker = new Map();
  for (const constituent of constituents) {
    const ticker = normalizeTicker(constituent?.ticker);
    if (!ticker || constituentByTicker.has(ticker)) continue;
    constituentByTicker.set(ticker, { ...constituent, ticker });
  }

  const featuredOrder = [
    ...CHART_BENCHMARK_TICKERS,
    ...featuredTickers.map(normalizeTicker).filter(Boolean),
  ];
  const featuredSet = new Set();
  const featured = [];

  for (const ticker of featuredOrder) {
    if (featuredSet.has(ticker)) continue;
    const option = getChartBenchmarkDefinition(ticker) ?? constituentByTicker.get(ticker);
    if (!option) continue;
    featuredSet.add(ticker);
    featured.push({ ...option, featured: true });
  }

  const remaining = [...constituentByTicker.values()]
    .filter((item) => !featuredSet.has(item.ticker))
    .sort((left, right) => left.ticker.localeCompare(right.ticker, 'en'))
    .map((item) => ({ ...item, featured: false }));

  return [...featured, ...remaining];
}
