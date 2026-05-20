import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createAlpacaClient } from '../lib/brokers/alpaca-client.js';
import { getExecutionConfig } from '../lib/execution/config.js';
import { fetchAndNormalizeAlpacaState } from '../lib/execution/alpaca-state.js';
import { insertBrokerStateSnapshots } from '../lib/repositories/broker-state.js';
import { updateExecutionOrderByBrokerOrderId } from '../lib/repositories/execution.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'alpaca_sync';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  taskLabel: 'alpaca:sync',
  setExitCode(code) {
    process.exitCode = code;
  },
});
const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'alpaca:sync interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const config = getExecutionConfig();
    const brokerClient = createAlpacaClient(config.alpaca);
    const { rawState, brokerState, snapshotRows } = await fetchAndNormalizeAlpacaState({
      brokerClient,
      config,
    });

    await insertBrokerStateSnapshots(snapshotRows);

    let updatedOrders = 0;
    for (const order of rawState.openOrders) {
      updatedOrders += await updateExecutionOrderByBrokerOrderId({
        broker: 'alpaca',
        broker_order_id: order.id,
        broker_status: order.status ?? null,
        response_json: order,
      });
    }

    await fetchRunGuard.finish('success', {
      totalItems: snapshotRows.length + updatedOrders,
      successfulItems: snapshotRows.length + updatedOrders,
      failedItems: 0,
      metadata: {
        accountStatus: brokerState.account.status,
        positions: brokerState.positions.length,
        openOrders: brokerState.openOrders.length,
        updatedOrders,
      },
    });

    console.log(`alpaca:sync positions=${brokerState.positions.length} openOrders=${brokerState.openOrders.length} updatedOrders=${updatedOrders}`);
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
    console.error('alpaca:sync failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
