import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { calculateTickerIndicators } from '../lib/utils/rolling-indicators.js';
import {
  accumulateMarketBreadth,
  createMarketBreadthAccumulator,
  finalizeMarketBreadthRows,
} from '../lib/utils/market-breadth.js';
import { upsertMarketBreadthDaily } from '../lib/repositories/breadth.js';
import {
  getPriceHistoryForIndicators,
  upsertStockDailyIndicators,
} from '../lib/repositories/indicators.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';

const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

ensureEnvLoaded();

const unregisterSignalHandlers = fetchRunGuard.register(process);

function getCalculationOptions() {
  const ticker = process.env.CALCULATE_TICKER?.trim().toUpperCase() || null;
  const rawLimit = process.env.CALCULATE_TICKER_LIMIT;
  const parsedLimit = rawLimit ? Number(rawLimit) : null;
  const tickerLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : null;

  return { ticker, tickerLimit };
}

async function processTickerRows(rows) {
  const indicators = calculateTickerIndicators(rows);
  const inserted = await upsertStockDailyIndicators(indicators);
  return { indicators, inserted };
}

async function run() {
  await failRunningFetchRuns('calculate_daily', 'calculate:daily interrupted before completion', {
    recoveredBy: 'calculate_daily',
  });
  const fetchRunId = await startFetchRun('calculate_daily');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const options = getCalculationOptions();

    if (options.ticker) {
      console.log(`CALCULATE_TICKER=${options.ticker}; limiting indicator calculation to one ticker.`);
    } else if (options.tickerLimit) {
      console.log(`CALCULATE_TICKER_LIMIT=${options.tickerLimit}; limiting indicator calculation for local test.`);
    }

    const priceRows = await getPriceHistoryForIndicators(options);
    if (!priceRows.length) {
      throw new Error('No stock price history found for indicator calculation.');
    }

    const failedTickers = [];
    let rowsCalculated = 0;
    let successfulTickers = 0;
    let attemptedTickers = 0;
    const totalTickers = new Set(priceRows.map((row) => row.ticker)).size;
    const shouldBuildBreadth = !options.ticker && !options.tickerLimit;
    const breadthAccumulator = shouldBuildBreadth
      ? createMarketBreadthAccumulator()
      : null;
    let currentTicker = null;
    let currentRows = [];

    async function flushCurrentTicker() {
      if (!currentTicker || !currentRows.length) {
        return;
      }

      attemptedTickers += 1;

      try {
        if (attemptedTickers === 1 || attemptedTickers % 25 === 0 || attemptedTickers === totalTickers) {
          console.log(`Calculating indicators ${attemptedTickers}/${totalTickers}: ${currentTicker} (${currentRows.length} rows)`);
        }
        const { indicators, inserted } = await processTickerRows(currentRows);
        rowsCalculated += inserted;
        successfulTickers += 1;

        if (breadthAccumulator) {
          accumulateMarketBreadth(breadthAccumulator, indicators);
        }
      } catch (error) {
        console.warn(`Failed indicator calculation for ${currentTicker}: ${error.message}`);
        failedTickers.push({ ticker: currentTicker, error: error.message });
      }
    }

    for (const row of priceRows) {
      if (currentTicker && row.ticker !== currentTicker) {
        await flushCurrentTicker();
        currentRows = [];
      }

      currentTicker = row.ticker;
      currentRows.push(row);
    }

    await flushCurrentTicker();

    let breadthRowsUpserted = 0;
    if (breadthAccumulator) {
      const breadthRows = finalizeMarketBreadthRows(breadthAccumulator);
      breadthRowsUpserted = await upsertMarketBreadthDaily(breadthRows);
      console.log(`Breadth rows upserted: ${breadthRowsUpserted}`);
    } else {
      console.log('Skipping breadth rebuild because calculation scope is limited.');
    }

    const failedItems = failedTickers.length;
    const status = failedItems > 0 ? 'partial_success' : 'success';

    await fetchRunGuard.finish(status, {
      totalItems: attemptedTickers,
      successfulItems: successfulTickers,
      failedItems,
      metadata: {
        rowsCalculated,
        breadthRowsUpserted,
        options,
        failedTickers,
      },
    });

    console.log(`calculate:daily completed with status: ${status}`);
    console.log(`Indicators: ${successfulTickers}/${attemptedTickers} tickers succeeded.`);
    console.log(`Rows upserted: ${rowsCalculated}`);
  } catch (error) {
    await fetchRunGuard.finish('failure', {
      errorMessage: error.message,
      metadata: { stack: error.stack },
    });
    throw error;
  }
}

run()
  .catch((error) => {
    console.error('calculate:daily failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
