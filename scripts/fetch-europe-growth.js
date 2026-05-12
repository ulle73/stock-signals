import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { fetchAndStoreEuropeGrowthIndicators } from '../lib/repositories/europe-growth-indicators.js';

ensureEnvLoaded();

async function run() {
  const result = await fetchAndStoreEuropeGrowthIndicators();

  console.log(`Europe Growth Indicators period: ${result.periodDate}`);
  console.log(`Inserted/updated rows: ${result.inserted}`);

  for (const row of result.rows) {
    console.log(`${row.label}: ${row.value}`);
  }

  for (const failure of result.failures) {
    console.warn(`${failure.label}: NA (${failure.error})`);
  }
}

run()
  .catch((error) => {
    console.error('fetch:europe-growth failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
