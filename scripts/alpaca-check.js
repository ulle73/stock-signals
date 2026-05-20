import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createAlpacaClient } from '../lib/brokers/alpaca-client.js';
import { getExecutionConfig } from '../lib/execution/config.js';
import { fetchAndNormalizeAlpacaState } from '../lib/execution/alpaca-state.js';
import { insertBrokerStateSnapshots } from '../lib/repositories/broker-state.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'alpaca_check';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  taskLabel: 'alpaca:check',
  setExitCode(code) {
    process.exitCode = code;
  },
});
const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'alpaca:check interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const config = getExecutionConfig();
    const brokerClient = createAlpacaClient(config.alpaca);
    const { brokerState, snapshotRows } = await fetchAndNormalizeAlpacaState({
      brokerClient,
      config,
    });

    await insertBrokerStateSnapshots(snapshotRows);

    await fetchRunGuard.finish('success', {
      totalItems: snapshotRows.length,
      successfulItems: snapshotRows.length,
      failedItems: 0,
      metadata: {
        accountStatus: brokerState.account.status,
        cash: brokerState.account.cash,
        equity: brokerState.account.equity,
        positions: brokerState.positions.length,
        openOrders: brokerState.openOrders.length,
      },
    });

    console.log(`alpaca:check account=${brokerState.account.status} positions=${brokerState.positions.length} openOrders=${brokerState.openOrders.length}`);
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
    console.error('alpaca:check failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
