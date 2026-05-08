import { formatIndicatorValueForStorage } from './rolling-indicators.js';
import { DEFAULT_SIGNAL_COVERAGE_THRESHOLD } from './market-breadth.js';

function createSectorDailyCounters(date, sector) {
  return {
    date,
    sector,
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

function getBucketKey(date, sector) {
  return `${date}__${sector}`;
}

export function createSectorBreadthAccumulator(signalCoverageThreshold = DEFAULT_SIGNAL_COVERAGE_THRESHOLD) {
  return {
    signalCoverageThreshold,
    byDateSector: new Map(),
  };
}

export function accumulateSectorBreadth(accumulator, rows) {
  for (const row of rows) {
    if (!row.sector) {
      continue;
    }

    const key = getBucketKey(row.date, row.sector);
    const counters = accumulator.byDateSector.get(key) ?? createSectorDailyCounters(row.date, row.sector);
    accumulator.byDateSector.set(key, counters);

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

export function finalizeSectorBreadthRows(accumulator) {
  return Array.from(accumulator.byDateSector.values())
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare !== 0 ? dateCompare : a.sector.localeCompare(b.sector);
    })
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

export function buildSectorBreadthRows(rows, signalCoverageThreshold = DEFAULT_SIGNAL_COVERAGE_THRESHOLD) {
  const accumulator = createSectorBreadthAccumulator(signalCoverageThreshold);
  accumulateSectorBreadth(accumulator, rows);
  return finalizeSectorBreadthRows(accumulator);
}
