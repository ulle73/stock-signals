import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { getMarketSignalEventSourceRows } from '../lib/repositories/market-signals.js';
import { getRegimeGatedBreakoutEventSourceRows } from '../lib/repositories/regime-gated-breakout.js';
import { upsertSignalEvents } from '../lib/repositories/signal-events.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import {
  buildMarketRegimeChangeSignalEvents,
  buildRegimeGatedBreakoutSignalEvents,
} from '../lib/utils/signal-events.js';

ensureEnvLoaded();

const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns('build_signal_events', 'build:signal-events interrupted before completion', {
    recoveredBy: 'build_signal_events',
  });
  const fetchRunId = await startFetchRun('build_signal_events');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const [marketSignalRows, breakoutRows] = await Promise.all([
      getMarketSignalEventSourceRows(),
      getRegimeGatedBreakoutEventSourceRows(),
    ]);
    const marketEvents = buildMarketRegimeChangeSignalEvents(marketSignalRows);
    const breakoutEvents = buildRegimeGatedBreakoutSignalEvents(breakoutRows);
    const events = [...marketEvents, ...breakoutEvents];
    const upserted = await upsertSignalEvents(events);

    await fetchRunGuard.finish('success', {
      totalItems: marketSignalRows.length + breakoutRows.length,
      successfulItems: upserted,
      failedItems: 0,
      metadata: {
        marketSignalRowsRead: marketSignalRows.length,
        breakoutRowsRead: breakoutRows.length,
        marketEventsBuilt: marketEvents.length,
        breakoutEventsBuilt: breakoutEvents.length,
        signalEventsBuilt: events.length,
      },
    });

    console.log(`Built ${events.length} signal event rows from ${marketSignalRows.length} market signal rows and ${breakoutRows.length} breakout rows.`);
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
    console.error('build:signal-events failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
