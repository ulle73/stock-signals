import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createAlpacaClient } from '../lib/brokers/alpaca-client.js';
import { getMarkovPaperAccountConfigs } from '../lib/execution/config.js';
import { runExecutionPipeline } from '../lib/execution/run-execution-pipeline.js';
import { getLatestTickerMarkovStrategyExecutionIntents } from '../lib/execution/source-adapters/ticker-markov-strategy-adapter.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'alpaca_markov_dry_run';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  taskLabel: 'alpaca:markov-dry-run',
  setExitCode(code) {
    process.exitCode = code;
  },
});
const unregisterSignalHandlers = fetchRunGuard.register(process);

function buildClientOrderId(accountId, intent) {
  return `mkv-${accountId}-${intent.symbol}-${intent.signal_date.replace(/-/g, '')}`.slice(0, 48);
}

async function runAccount(accountConfig, now) {
  const brokerClient = createAlpacaClient(accountConfig.alpaca);

  return runExecutionPipeline({
    mode: 'dry_run',
    broker: accountConfig.broker,
    loadIntents: ({ brokerState }) => getLatestTickerMarkovStrategyExecutionIntents({
      strategyName: accountConfig.strategyName,
      brokerState,
      brokerClient,
      now,
    }),
    brokerClient,
    config: accountConfig,
    now,
    generateClientOrderId: ({ intent }) => buildClientOrderId(accountConfig.accountId, intent),
  });
}

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'alpaca:markov-dry-run interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const accounts = getMarkovPaperAccountConfigs();
    if (!accounts.length) {
      await fetchRunGuard.finish('success', {
        totalItems: 0,
        successfulItems: 0,
        failedItems: 0,
        metadata: { message: 'No Markov paper accounts configured.' },
      });
      console.log('alpaca:markov-dry-run no accounts configured');
      return;
    }

    const now = new Date();
    const summaries = [];

    for (const accountConfig of accounts) {
      const result = await runAccount(accountConfig, now);
      summaries.push({
        accountId: accountConfig.accountId,
        strategyName: accountConfig.strategyName,
        broker: accountConfig.broker,
        snapshotCount: result.snapshotCount,
        decisionStatuses: result.results.map((row) => row.decisionStatus),
        intentCount: result.results.length,
      });
    }

    await fetchRunGuard.finish('success', {
      totalItems: summaries.reduce((sum, row) => sum + row.intentCount, 0),
      successfulItems: summaries.reduce((sum, row) => sum + row.intentCount, 0),
      failedItems: 0,
      metadata: { accounts: summaries },
    });

    console.log(`alpaca:markov-dry-run accounts=${summaries.length} intents=${summaries.reduce((sum, row) => sum + row.intentCount, 0)}`);
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
    console.error('alpaca:markov-dry-run failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
