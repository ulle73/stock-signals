import fs from 'node:fs/promises';
import { closePool, query } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';

// Deliberately applies only the isolated Radar schema, not unrelated pending migrations.
ensureEnvLoaded();
async function main() {
  const sql = await fs.readFile(
    new URL('../db/migrations/20261123_market_radar_research.sql', import.meta.url), 'utf8'
  );
  await query(sql);
  console.log('Market Radar research schema is ready.');
}
main()
  .catch((error) => { console.error('Radar migration failed:', error.message); process.exitCode = 1; })
  .finally(async () => closePool());
