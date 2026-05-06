import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import {
  getIndicatorValidationWindow,
  getLatestIndicatorDateForTicker,
  getStoredIndicatorRow,
} from '../lib/repositories/indicators.js';
import {
  DEFAULT_HIGH_LOW_WINDOW_SIZE,
  DEFAULT_INDICATOR_WINDOWS,
  DERIVED_INDICATOR_KEYS,
  calculateTickerIndicators,
  formatIndicatorValueForStorage,
} from '../lib/utils/rolling-indicators.js';

ensureEnvLoaded();

function getArgs() {
  const ticker = process.argv[2]?.trim().toUpperCase() || 'AAPL';
  const date = process.argv[3]?.trim() || null;
  return { ticker, date };
}

function summarizeWindow(rows, size) {
  if (rows.length < size) {
    return {
      count: rows.length,
      start: null,
      end: rows.at(-1)?.date ?? null,
    };
  }

  const slice = rows.slice(-size);
  return {
    count: slice.length,
    start: slice[0].date,
    end: slice.at(-1).date,
  };
}

function valuesMatch(a, b) {
  return formatIndicatorValueForStorage(a) === formatIndicatorValueForStorage(b);
}

function buildIndicatorFieldMap(row) {
  return Object.fromEntries(
    DEFAULT_INDICATOR_WINDOWS.map((window) => [
      window.key,
      formatIndicatorValueForStorage(row[window.key]),
    ])
  );
}

function buildDerivedFieldMap(row) {
  return Object.fromEntries(
    DERIVED_INDICATOR_KEYS.map((key) => [
      key,
      formatIndicatorValueForStorage(row[key]),
    ])
  );
}

async function run() {
  const { ticker, date: requestedDate } = getArgs();
  const date = requestedDate || await getLatestIndicatorDateForTicker(ticker);

  if (!date) {
    throw new Error(`No stored indicator rows found for ${ticker}. Run npm run calculate:daily first.`);
  }

  const storedRow = await getStoredIndicatorRow(ticker, date);
  if (!storedRow) {
    throw new Error(`No stored indicator row found for ${ticker} on ${date}.`);
  }

  const windowRows = await getIndicatorValidationWindow(ticker, date, DEFAULT_HIGH_LOW_WINDOW_SIZE);
  if (!windowRows.length) {
    throw new Error(`No price history found for ${ticker} on or before ${date}.`);
  }

  const recalculatedRow = calculateTickerIndicators(windowRows).at(-1);
  const lastPriceRow = windowRows.at(-1);

  const report = {
    ticker,
    date,
    priceBasis: storedRow.price_basis,
    sourcePrice: {
      close: lastPriceRow.close,
      adj_close: lastPriceRow.adj_close,
      volume: lastPriceRow.volume,
      indicator_price_used: formatIndicatorValueForStorage(recalculatedRow.indicator_price),
    },
    stored: storedRow,
    recalculated: {
      indicator_price: formatIndicatorValueForStorage(recalculatedRow.indicator_price),
      ...buildDerivedFieldMap(recalculatedRow),
      ...buildIndicatorFieldMap(recalculatedRow),
    },
    matches: {
      indicator_price: valuesMatch(storedRow.indicator_price, recalculatedRow.indicator_price),
      ...Object.fromEntries(
        DERIVED_INDICATOR_KEYS.map((key) => [
          key,
          valuesMatch(storedRow[key], recalculatedRow[key]),
        ])
      ),
      ...Object.fromEntries(
        DEFAULT_INDICATOR_WINDOWS.map((window) => [
          window.key,
          valuesMatch(storedRow[window.key], recalculatedRow[window.key]),
        ])
      ),
    },
    windows: Object.fromEntries(
      DEFAULT_INDICATOR_WINDOWS.map((window) => [
        window.key,
        summarizeWindow(windowRows, window.size),
      ])
    ),
  };

  console.log(JSON.stringify(report, null, 2));
}

run()
  .catch((error) => {
    console.error('validate:indicator failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
