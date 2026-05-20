import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createAlpacaClient } from '../lib/brokers/alpaca-client.js';
import { getExecutionConfig } from '../lib/execution/config.js';
import { getLatestTradingSignalExecutionIntents } from '../lib/execution/source-adapters/trading-signal-adapter.js';
import { runExecutionPipeline } from '../lib/execution/run-execution-pipeline.js';
import { getLatestTradingSignalRow } from '../lib/repositories/trading-signals.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'alpaca_dry_run';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  taskLabel: 'alpaca:dry-run',
  setExitCode(code) {
    process.exitCode = code;
  },
});
const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'alpaca:dry-run interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const config = getExecutionConfig();
    const brokerClient = createAlpacaClient(config.alpaca);
    const result = await runExecutionPipeline({
      mode: 'dry_run',
      loadIntents: () => getLatestTradingSignalExecutionIntents({ getLatestTradingSignalRow }),
      brokerClient,
      config,
      now: new Date(),
    });

    await fetchRunGuard.finish('success', {
      totalItems: result.results.length,
      successfulItems: result.results.length,
      failedItems: 0,
      metadata: {
        snapshotCount: result.snapshotCount,
        decisionStatuses: result.results.map((row) => row.decisionStatus),
      },
    });

    console.log(`alpaca:dry-run intents=${result.results.length} statuses=${result.results.map((row) => row.decisionStatus).join(',') || 'none'}`);
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
    console.error('alpaca:dry-run failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
