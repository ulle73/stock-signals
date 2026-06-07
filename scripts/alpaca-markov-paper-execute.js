import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createAlpacaClient } from '../lib/brokers/alpaca-client.js';
import { getMarkovPaperAccountConfigs } from '../lib/execution/config.js';
import { runExecutionPipeline } from '../lib/execution/run-execution-pipeline.js';
import { getLatestTickerMarkovStrategyExecutionIntents } from '../lib/execution/source-adapters/ticker-markov-strategy-adapter.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'alpaca_markov_paper_execute';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  taskLabel: 'alpaca:markov-paper-execute',
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
    mode: 'paper_execute',
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
  await failRunningFetchRuns(JOB_NAME, 'alpaca:markov-paper-execute interrupted before completion', {
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
      console.log('alpaca:markov-paper-execute no accounts configured');
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
        sentCount: result.results.filter((row) => row.decisionStatus === 'sent').length,
        blockedCount: result.results.filter((row) => row.decisionStatus === 'blocked').length,
      });
    }

    const totalIntents = summaries.reduce((sum, row) => sum + row.intentCount, 0);
    const totalSent = summaries.reduce((sum, row) => sum + row.sentCount, 0);
    const totalBlocked = summaries.reduce((sum, row) => sum + row.blockedCount, 0);

    await fetchRunGuard.finish(totalBlocked > 0 ? 'partial_success' : 'success', {
      totalItems: totalIntents,
      successfulItems: totalSent,
      failedItems: totalBlocked,
      metadata: { accounts: summaries },
    });

    console.log(`alpaca:markov-paper-execute accounts=${summaries.length} intents=${totalIntents} sent=${totalSent} blocked=${totalBlocked}`);
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
    console.error('alpaca:markov-paper-execute failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
