import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const DEFAULT_LOOKBACK_PERIODS = {
  rs_21d_vs_spy: 21,
  rs_63d_vs_spy: 63,
  rs_126d_vs_spy: 126,
};

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNumber(value) {
  const number = toNumber(value);
  if (number === null) {
    return null;
  }

  return Number(formatIndicatorValueForStorage(number));
}

function getIndicatorPrice(row) {
  return toNumber(row.adj_close ?? row.close);
}

function sortRowsByDate(rows) {
  return [...rows].sort((left, right) => left.date.localeCompare(right.date));
}

function calculateReturnPct(currentPrice, previousPrice) {
  if (currentPrice === null || previousPrice === null || previousPrice <= 0) {
    return null;
  }

  return (currentPrice / previousPrice) - 1;
}

function calculateRelativeStrengthValue(stockCurrentPrice, stockPreviousPrice, benchmarkCurrentPrice, benchmarkPreviousPrice) {
  const stockReturn = calculateReturnPct(stockCurrentPrice, stockPreviousPrice);
  const benchmarkReturn = calculateReturnPct(benchmarkCurrentPrice, benchmarkPreviousPrice);

  if (stockReturn === null || benchmarkReturn === null || (1 + benchmarkReturn) === 0) {
    return null;
  }

  return normalizeNumber((((1 + stockReturn) / (1 + benchmarkReturn)) - 1) * 100);
}

function buildRankedFieldMaps(rows, scoreField, rankField, percentileField) {
  const rankedRows = rows
    .filter((row) => row[scoreField] !== null)
    .sort((left, right) => {
      const scoreDiff = right[scoreField] - left[scoreField];
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return left.ticker.localeCompare(right.ticker);
    });

  const rowCount = rankedRows.length;
  const byTicker = new Map();

  rankedRows.forEach((row, index) => {
    byTicker.set(row.ticker, {
      [rankField]: index + 1,
      [percentileField]: normalizeNumber(((rowCount - index) / rowCount) * 100),
    });
  });

  return byTicker;
}

function applyRanksByDate(rows) {
  const rowsByDate = new Map();

  for (const row of rows) {
    const dateRows = rowsByDate.get(row.date) ?? [];
    dateRows.push({ ...row });
    rowsByDate.set(row.date, dateRows);
  }

  return [...rowsByDate.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .flatMap(([, dateRows]) => {
      const rank21dByTicker = buildRankedFieldMaps(dateRows, 'rs_21d_vs_spy', 'rs_rank_21d', 'rs_percentile_21d');
      const rank63dByTicker = buildRankedFieldMaps(dateRows, 'rs_63d_vs_spy', 'rs_rank_63d', 'rs_percentile_63d');
      const rank126dByTicker = buildRankedFieldMaps(dateRows, 'rs_126d_vs_spy', 'rs_rank_126d', 'rs_percentile_126d');

      return dateRows.map((row) => ({
        ...row,
        rs_rank_21d: rank21dByTicker.get(row.ticker)?.rs_rank_21d ?? null,
        rs_rank_63d: rank63dByTicker.get(row.ticker)?.rs_rank_63d ?? null,
        rs_rank_126d: rank126dByTicker.get(row.ticker)?.rs_rank_126d ?? null,
        rs_percentile_21d: rank21dByTicker.get(row.ticker)?.rs_percentile_21d ?? null,
        rs_percentile_63d: rank63dByTicker.get(row.ticker)?.rs_percentile_63d ?? null,
        rs_percentile_126d: rank126dByTicker.get(row.ticker)?.rs_percentile_126d ?? null,
      }));
    });
}

export function buildRelativeStrengthRows({
  priceRows,
  benchmarkRows,
  benchmarkTicker = 'SPY',
  lookbackPeriods = DEFAULT_LOOKBACK_PERIODS,
}) {
  const benchmarkSeries = sortRowsByDate(benchmarkRows).map((row) => ({
    date: row.date,
    price: getIndicatorPrice(row),
  }));
  const benchmarkByDate = new Map(
    benchmarkSeries.map((row, index) => [row.date, { index, price: row.price }])
  );

  const rowsByTicker = new Map();

  // V1 intentionally ranks against the current active S&P 500 universe, which is survivorship-biased historically.
  for (const row of priceRows) {
    const tickerRows = rowsByTicker.get(row.ticker) ?? [];
    tickerRows.push(row);
    rowsByTicker.set(row.ticker, tickerRows);
  }

  const baseRows = [...rowsByTicker.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .flatMap(([ticker, tickerRows]) => {
      const sortedTickerRows = sortRowsByDate(tickerRows).map((row) => ({
        date: row.date,
        price: getIndicatorPrice(row),
      }));

      return sortedTickerRows.map((row, index) => {
        const benchmarkCurrent = benchmarkByDate.get(row.date);
        const relativeStrengthFields = {};

        for (const [scoreField, lookback] of Object.entries(lookbackPeriods)) {

          if (!benchmarkCurrent || index < lookback || benchmarkCurrent.index < lookback) {
            relativeStrengthFields[scoreField] = null;
            continue;
          }

          relativeStrengthFields[scoreField] = calculateRelativeStrengthValue(
            row.price,
            sortedTickerRows[index - lookback].price,
            benchmarkCurrent.price,
            benchmarkSeries[benchmarkCurrent.index - lookback].price
          );
        }

        return {
          ticker,
          date: row.date,
          benchmark_ticker: benchmarkTicker,
          rs_21d_vs_spy: relativeStrengthFields.rs_21d_vs_spy ?? null,
          rs_63d_vs_spy: relativeStrengthFields.rs_63d_vs_spy ?? null,
          rs_126d_vs_spy: relativeStrengthFields.rs_126d_vs_spy ?? null,
          rs_rank_21d: null,
          rs_rank_63d: null,
          rs_rank_126d: null,
          rs_percentile_21d: null,
          rs_percentile_63d: null,
          rs_percentile_126d: null,
        };
      });
    });

  return applyRanksByDate(baseRows);
}
