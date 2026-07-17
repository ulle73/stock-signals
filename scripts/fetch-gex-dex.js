import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { upsertGexDexSnapshot } from '../lib/repositories/gex-dex-snapshots.js';
import {
  getTopVolumeGexDexTickers,
  mergeGexDexTickerUniverse,
} from '../lib/repositories/gex-dex-universe.js';
import { fetchGammaLensGexDex, resolveGammaLensGexDexTickers } from '../lib/sources/gammalens-gex-dex.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { fetchAndStoreGexDexSnapshots } from '../lib/utils/gex-dex-fetcher.js';

ensureEnvLoaded();

const JOB_NAME = 'fetch_gex_dex';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'fetch-gex-dex interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  const configuredTickers = resolveGammaLensGexDexTickers(process.env.GEX_DEX_TICKERS);
  let topVolumeTickers = [];
  let tickers = configuredTickers;

  try {
    topVolumeTickers = await getTopVolumeGexDexTickers({
      limit: process.env.GEX_DEX_TOP_VOLUME_LIMIT,
      lookbackSessions: process.env.GEX_DEX_TOP_VOLUME_LOOKBACK,
    });
    tickers = mergeGexDexTickerUniverse(configuredTickers, topVolumeTickers);

    const result = await fetchAndStoreGexDexSnapshots({
      tickers,
      concurrency: process.env.GEX_DEX_FETCH_CONCURRENCY,
      fetchSnapshot: fetchGammaLensGexDex,
      storeSnapshot: upsertGexDexSnapshot,
    });
    const status = result.failedItems.length
      ? result.successfulItems ? 'partial_success' : 'failure'
      : 'success';

    await fetchRunGuard.finish(status, {
      totalItems: tickers.length,
      successfulItems: result.successfulItems,
      failedItems: result.failedItems.length,
      errorMessage: status === 'failure' ? 'No GammaLens GEX/DEX snapshots could be fetched.' : null,
      metadata: {
        configuredTickers,
        topVolumeTickers,
        tickers,
        snapshotIds: result.snapshotIds,
        failedItems: result.failedItems,
      },
    });

    if (status === 'failure') {
      throw new Error('No GammaLens GEX/DEX snapshots could be fetched.');
    }

    console.log(
      `Fetched GEX/DEX snapshots for ${result.successfulItems}/${tickers.length} tickers `
      + `(${configuredTickers.length} configured + ${topVolumeTickers.length} top-volume before deduplication).`
    );
  } catch (error) {
    await fetchRunGuard.finish('failure', {
      errorMessage: error.message,
      metadata: {
        configuredTickers,
        topVolumeTickers,
        tickers,
        stack: error.stack,
      },
    });
    throw error;
  }
}

run()
  .catch((error) => {
    console.error('fetch-gex-dex failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
