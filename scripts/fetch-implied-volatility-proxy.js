import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { fetchYahooDailyCandles } from '../lib/sources/yahoo.js';
import {
  buildImpliedVolatilityProxySourceRows,
  IMPLIED_VOLATILITY_PROXY_ASSET_DEFINITIONS,
  upsertImpliedVolatilityProxySourceRows,
} from '../lib/repositories/implied-volatility-proxy-source.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'fetch_implied_volatility_proxy';
const YAHOO_REQUEST = { range: process.env.IMPLIED_VOLATILITY_PROXY_RANGE?.trim() || '800d' };
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'fetch-implied-volatility-proxy interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  const failedAssets = [];
  const assetSummaries = [];
  let insertedRows = 0;

  try {
    for (const definition of IMPLIED_VOLATILITY_PROXY_ASSET_DEFINITIONS) {
      console.log(`Fetching IV proxy source rows for ${definition.assetKey} (${definition.sourceSymbol} / ${definition.impliedVolatilitySymbol})`);

      try {
        const priceRows = await fetchYahooDailyCandles(definition.sourceSymbol, YAHOO_REQUEST);
        let impliedVolatilityRows = [];
        let ivFetchError = null;

        try {
          impliedVolatilityRows = await fetchYahooDailyCandles(definition.impliedVolatilitySymbol, YAHOO_REQUEST);
        } catch (error) {
          ivFetchError = error.message;
          console.warn(`IV proxy fetch missing for ${definition.assetKey}: ${error.message}`);
        }

        const sourceRows = buildImpliedVolatilityProxySourceRows(
          definition,
          priceRows,
          impliedVolatilityRows,
          YAHOO_REQUEST
        );
        insertedRows += await upsertImpliedVolatilityProxySourceRows(sourceRows);
        assetSummaries.push({
          assetKey: definition.assetKey,
          priceRows: priceRows.length,
          impliedVolatilityRows: impliedVolatilityRows.length,
          sourceRows: sourceRows.length,
          ivFetchError,
        });
      } catch (error) {
        console.warn(`Failed implied-volatility proxy fetch for ${definition.assetKey}: ${error.message}`);
        failedAssets.push({
          assetKey: definition.assetKey,
          error: error.message,
        });
      }
    }

    const successfulAssets = assetSummaries.length;
    const failedItems = failedAssets.length;
    const status = successfulAssets === 0
      ? 'failure'
      : failedItems > 0
        ? 'partial_success'
        : 'success';

    await fetchRunGuard.finish(status, {
      totalItems: IMPLIED_VOLATILITY_PROXY_ASSET_DEFINITIONS.length,
      successfulItems: successfulAssets,
      failedItems,
      metadata: {
        insertedRows,
        yahooRequest: YAHOO_REQUEST,
        assetSummaries,
        failedAssets,
      },
    });

    if (status === 'failure') {
      throw new Error('No implied-volatility proxy assets could be fetched.');
    }

    console.log(`Fetched ${insertedRows} implied-volatility proxy source rows.`);
  } catch (error) {
    await fetchRunGuard.finish('failure', {
      errorMessage: error.message,
      metadata: {
        insertedRows,
        yahooRequest: YAHOO_REQUEST,
        assetSummaries,
        failedAssets,
        stack: error.stack,
      },
    });
    throw error;
  }
}

run()
  .catch((error) => {
    console.error('fetch-implied-volatility-proxy failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
