import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('package.json exposes alpaca operational scripts', async () => {
  const packageJson = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(packageJson.scripts['alpaca:check'], 'node scripts/alpaca-check.js');
  assert.equal(packageJson.scripts['alpaca:sync'], 'node scripts/alpaca-sync.js');
  assert.equal(packageJson.scripts['alpaca:dry-run'], 'node scripts/alpaca-dry-run.js');
  assert.equal(packageJson.scripts['alpaca:paper-execute'], 'node scripts/alpaca-paper-execute.js');
  assert.equal(packageJson.scripts['alpaca:markov-dry-run'], 'node scripts/alpaca-markov-dry-run.js');
  assert.equal(packageJson.scripts['alpaca:markov-paper-execute'], 'node scripts/alpaca-markov-paper-execute.js');
});
