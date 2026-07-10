import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync(new URL('../.github/workflows/fetch-daily.yml', import.meta.url), 'utf8');

function workflowJob(name, nextName) {
  const start = workflow.indexOf(`  ${name}:`);
  const end = workflow.indexOf(`  ${nextName}:`, start);
  return workflow.slice(start, end === -1 ? undefined : end);
}

test('daily workflow exposes and routes the refresh execution mode', () => {
  const fetchJob = workflowJob('fetch-and-calculate-daily', 'calculate-derived-signals');
  const derivedJob = workflowJob('calculate-derived-signals', 'run-daily-backtests');

  assert.match(workflow, /execution_mode: \$\{\{ steps\.check\.outputs\.execution_mode \}\}/);
  assert.match(fetchJob, /execution_mode == 'fetch_and_calculate'/);
  assert.match(derivedJob, /execution_mode == 'calculate_only'/);
  assert.doesNotMatch(derivedJob, /npm run fetch:/);
});
