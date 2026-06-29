import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import {
  getRegimeGatedBreakoutSourceRows,
  upsertRegimeGatedBreakoutRows,
} from '../lib/repositories/regime-gated-breakout.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { buildRegimeGatedBreakoutRowsFromSources } from '../lib/utils/regime-gated-breakout.js';

ensureEnvLoaded();

const JOB_NAME = 'calculate_regime_gated_breakout';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate:regime-gated-breakout interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getRegimeGatedBreakoutSourceRows();
    const breakoutRows = buildRegimeGatedBreakoutRowsFromSources(sourceRows);
    const inserted = await upsertRegimeGatedBreakoutRows(breakoutRows);
    const triggeredCount = breakoutRows.filter((row) => row.decision === 'trigger').length;

    await fetchRunGuard.finish('success', {
      totalItems: breakoutRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        breakoutRowsRead: sourceRows.breakoutRows.length,
        marketSignalRowsRead: sourceRows.marketSignalRows.length,
        sectorSignalRowsRead: sourceRows.sectorSignalRows.length,
        relativeStrengthRowsRead: sourceRows.relativeStrengthRows.length,
        qualityGateRowsRead: sourceRows.qualityGateRows.length,
        earningsCalendarRowsRead: sourceRows.earningsCalendarRows.length,
        breakoutRowsCalculated: breakoutRows.length,
        breakoutRowsTriggered: triggeredCount,
      },
    });

    console.log(`Calculated ${breakoutRows.length} Regime-Gated Breakout rows (${triggeredCount} triggers).`);
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
    console.error('calculate:regime-gated-breakout failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
