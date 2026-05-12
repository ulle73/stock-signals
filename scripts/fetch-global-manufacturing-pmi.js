import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { fetchAndStoreGlobalManufacturingPmi } from '../lib/repositories/global-manufacturing-pmi.js';

ensureEnvLoaded();

async function run() {
  const result = await fetchAndStoreGlobalManufacturingPmi();

  console.log(`Global Manufacturing PMI period: ${result.periodDate}`);
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
    console.error('fetch:global-manufacturing-pmi failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
