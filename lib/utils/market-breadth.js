import { formatIndicatorValueForStorage } from './rolling-indicators.js';

export const DEFAULT_SIGNAL_COVERAGE_THRESHOLD = 0.95;

function createDailyCounters(date) {
  return {
    date,
    active_ticker_count: 0,
    advancers: 0,
    decliners: 0,
    unchanged: 0,
    valid_sma20_count: 0,
    above_sma20_count: 0,
    valid_sma50_count: 0,
    above_sma50_count: 0,
    valid_sma200_count: 0,
    above_sma200_count: 0,
    valid_52w_count: 0,
    new_highs_52w: 0,
    new_lows_52w: 0,
  };
}

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function toPercentage(count, total) {
  if (!total) {
    return null;
  }

  return Number(formatIndicatorValueForStorage((count / total) * 100));
}

export function createMarketBreadthAccumulator(signalCoverageThreshold = DEFAULT_SIGNAL_COVERAGE_THRESHOLD) {
  return {
    signalCoverageThreshold,
    byDate: new Map(),
  };
}

export function accumulateMarketBreadth(accumulator, indicatorRows) {
  for (const row of indicatorRows) {
    const counters = accumulator.byDate.get(row.date) ?? createDailyCounters(row.date);
    accumulator.byDate.set(row.date, counters);

    const indicatorPrice = toNumber(row.indicator_price);
    const dailyReturn = toNumber(row.daily_return_pct);
    const sma20 = toNumber(row.sma20);
    const sma50 = toNumber(row.sma50);
    const sma200 = toNumber(row.sma200);
    const pctFrom52wHigh = toNumber(row.pct_from_52w_high);
    const pctFrom52wLow = toNumber(row.pct_from_52w_low);

    counters.active_ticker_count += 1;

    if (dailyReturn !== null) {
      if (dailyReturn > 0) {
        counters.advancers += 1;
      } else if (dailyReturn < 0) {
        counters.decliners += 1;
      } else {
        counters.unchanged += 1;
      }
    }

    if (sma20 !== null) {
      counters.valid_sma20_count += 1;
      if (indicatorPrice > sma20) {
        counters.above_sma20_count += 1;
      }
    }

    if (sma50 !== null) {
      counters.valid_sma50_count += 1;
      if (indicatorPrice > sma50) {
        counters.above_sma50_count += 1;
      }
    }

    if (sma200 !== null) {
      counters.valid_sma200_count += 1;
      if (indicatorPrice > sma200) {
        counters.above_sma200_count += 1;
      }
    }

    if (pctFrom52wHigh !== null && pctFrom52wLow !== null) {
      counters.valid_52w_count += 1;

      if (pctFrom52wHigh === 0) {
        counters.new_highs_52w += 1;
      }

      if (pctFrom52wLow === 0) {
        counters.new_lows_52w += 1;
      }
    }
  }
}

export function finalizeMarketBreadthRows(accumulator) {
  return Array.from(accumulator.byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((counters) => {
      const requiredTickerCount = Math.ceil(counters.active_ticker_count * accumulator.signalCoverageThreshold);

      return {
        ...counters,
        pct_above_sma20: toPercentage(counters.above_sma20_count, counters.valid_sma20_count),
        pct_above_sma50: toPercentage(counters.above_sma50_count, counters.valid_sma50_count),
        pct_above_sma200: toPercentage(counters.above_sma200_count, counters.valid_sma200_count),
        is_valid_signal_date:
          counters.valid_sma200_count >= requiredTickerCount &&
          counters.valid_52w_count >= requiredTickerCount,
      };
    });
}

export function buildMarketBreadthRows(indicatorRows, signalCoverageThreshold = DEFAULT_SIGNAL_COVERAGE_THRESHOLD) {
  const accumulator = createMarketBreadthAccumulator(signalCoverageThreshold);
  accumulateMarketBreadth(accumulator, indicatorRows);
  return finalizeMarketBreadthRows(accumulator);
}
