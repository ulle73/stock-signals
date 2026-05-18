import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import {
  buildMacroMatrixYahooProxySourceRows,
  getLatestMacroMatrixYahooProxyDates,
  getMacroMatrixYahooProxySymbols,
  upsertMacroMatrixYahooProxySourceRows,
} from '../lib/repositories/macro-matrix-yahoo-proxy-source.js';
import { fetchYahooDailyCandles } from '../lib/sources/yahoo.js';
import { chunkArray } from '../lib/utils/chunk.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import {
  getYahooProxyDailyInitialRange,
  getYahooProxyDailyRange,
} from '../lib/utils/fetch-settings.js';

ensureEnvLoaded();

const JOB_NAME = 'fetch_macro_matrix_yahoo_proxy';
const BATCH_SIZE = 6;
const UPDATE_REQUEST = { range: getYahooProxyDailyRange() };
const INITIAL_REQUEST = { range: getYahooProxyDailyInitialRange() };
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function fetchSymbol(symbol, latestDatesBySymbol) {
  const request = latestDatesBySymbol[symbol] ? UPDATE_REQUEST : INITIAL_REQUEST;
  const candles = await fetchYahooDailyCandles(symbol, request);
  const rows = buildMacroMatrixYahooProxySourceRows(symbol, candles, request);
  const insertedRows = await upsertMacroMatrixYahooProxySourceRows(rows);

  return {
    symbol,
    request,
    candleCount: candles.length,
    insertedRows,
    mode: latestDatesBySymbol[symbol] ? 'update' : 'backfill',
  };
}

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'fetch-macro-matrix-yahoo-proxy interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  const symbols = getMacroMatrixYahooProxySymbols();
  const latestDatesBySymbol = await getLatestMacroMatrixYahooProxyDates();
  const successfulSymbols = [];
  const failedSymbols = [];
  let insertedRows = 0;

  try {
    const batches = chunkArray(symbols, BATCH_SIZE);

    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`Fetching macro-matrix Yahoo proxies batch ${batchIndex + 1}/${batches.length}: ${batch.join(', ')}`);

      const results = await Promise.allSettled(
        batch.map((symbol) => fetchSymbol(symbol, latestDatesBySymbol))
      );

      for (const [resultIndex, result] of results.entries()) {
        if (result.status === 'fulfilled') {
          successfulSymbols.push(result.value);
          insertedRows += result.value.insertedRows;
          continue;
        }

        failedSymbols.push({
          symbol: batch[resultIndex],
          error: result.reason?.message ?? String(result.reason),
        });
      }
    }

    const status = successfulSymbols.length === 0
      ? 'failure'
      : failedSymbols.length > 0
        ? 'partial_success'
        : 'success';

    await fetchRunGuard.finish(status, {
      totalItems: symbols.length,
      successfulItems: successfulSymbols.length,
      failedItems: failedSymbols.length,
      metadata: {
        insertedRows,
        updateRequest: UPDATE_REQUEST,
        initialRequest: INITIAL_REQUEST,
        successfulSymbols,
        failedSymbols,
      },
    });

    if (status === 'failure') {
      throw new Error('No macro-matrix Yahoo proxy symbols could be fetched.');
    }

    console.log(`Fetched ${insertedRows} macro-matrix Yahoo proxy rows across ${successfulSymbols.length}/${symbols.length} symbols.`);
  } catch (error) {
    await fetchRunGuard.finish('failure', {
      errorMessage: error.message,
      metadata: {
        insertedRows,
        updateRequest: UPDATE_REQUEST,
        initialRequest: INITIAL_REQUEST,
        successfulSymbols,
        failedSymbols,
        stack: error.stack,
      },
    });
    throw error;
  }
}

run()
  .catch((error) => {
    console.error('fetch-macro-matrix-yahoo-proxy failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
