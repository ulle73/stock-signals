export const DEFAULT_TICKER = 'AAPL';

const MARKET_SERIES_META = [
  {
    seriesId: 'SP500',
    label: 'S&P 500',
    description: 'Index close',
  },
  {
    seriesId: 'VIXCLS',
    label: 'VIX',
    description: 'Volatility index',
  },
  {
    seriesId: 'BAMLH0A0HYM2',
    label: 'HY Spread',
    description: 'Credit stress',
  },
];

export function normalizeTickerInput(value, fallback = DEFAULT_TICKER) {
  const normalized = typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';

  return normalized || fallback;
}

export function buildMarketSeriesCards(rows) {
  const rowBySeriesId = new Map(
    rows.map((row) => [row.series_id, row])
  );

  return MARKET_SERIES_META.map((meta) => {
    const row = rowBySeriesId.get(meta.seriesId);

    return {
      ...meta,
      value: row?.value ?? null,
      date: row?.date ?? null,
    };
  });
}
