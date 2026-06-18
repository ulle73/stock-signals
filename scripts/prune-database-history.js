import { closePool, query } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import {
  buildHistoryPruneStatement,
  getHistoryPrunePlan,
  getHistoryPruneSettings,
  isHistoryPruneEnabled,
} from '../lib/utils/history-prune.js';

ensureEnvLoaded();

const JOB_NAME = 'prune_database_history';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function vacuumAnalyzeTable(table) {
  await query(`vacuum analyze ${table}`);
}

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'db:prune-history interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    if (!isHistoryPruneEnabled()) {
      await fetchRunGuard.finish('success', {
        totalItems: 0,
        successfulItems: 0,
        failedItems: 0,
        metadata: {
          enabled: false,
          reason: 'HISTORY_PRUNE_ENABLED is false or unset.',
        },
      });
      console.log('History pruning disabled; skipping db:prune-history.');
      return;
    }

    const settings = getHistoryPruneSettings();
    const plan = getHistoryPrunePlan();
    const tableResults = [];
    let totalDeleted = 0;

    for (const item of plan) {
      const statement = buildHistoryPruneStatement(item);
      const result = await query(statement.sql, statement.params);
      const deleted = result.rowCount ?? 0;
      totalDeleted += deleted;

      if (deleted > 0) {
        await vacuumAnalyzeTable(item.table);
      }

      tableResults.push({
        table: item.table,
        column: item.column,
        retention: item.retention,
        days: item.days,
        deleted,
      });
    }

    await fetchRunGuard.finish('success', {
      totalItems: plan.length,
      successfulItems: plan.length,
      failedItems: 0,
      metadata: {
        enabled: true,
        totalDeleted,
        settings,
        tableResults,
      },
    });

    console.log(`History pruning completed. Deleted ${totalDeleted} rows across ${plan.length} tables.`);
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
    console.error('db:prune-history failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
