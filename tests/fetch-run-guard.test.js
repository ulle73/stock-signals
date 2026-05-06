import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

test('marks an active fetch run as failure when interrupted', async () => {
  const calls = [];
  const events = new EventEmitter();
  let exitCode = 0;

  const guard = createFetchRunGuard({
    async finishRun(id, status, details) {
      calls.push({ type: 'finish', id, status, details });
    },
    async closePool() {
      calls.push({ type: 'closePool' });
    },
    setExitCode(code) {
      exitCode = code;
    },
  });

  guard.setRunId(42);
  const unregister = guard.register(events);

  await guard.handleSignal('SIGTERM');
  unregister();

  assert.deepEqual(calls, [
    {
      type: 'finish',
      id: 42,
      status: 'failure',
      details: {
        errorMessage: 'fetch:daily interrupted by SIGTERM',
        metadata: { signal: 'SIGTERM' },
      },
    },
    {
      type: 'closePool',
    },
  ]);
  assert.equal(exitCode, 1);
});

test('does not finish the same fetch run twice', async () => {
  const calls = [];
  let exitCode = 0;

  const guard = createFetchRunGuard({
    async finishRun(id, status, details) {
      calls.push({ id, status, details });
    },
    async closePool() {},
    setExitCode(code) {
      exitCode = code;
    },
  });

  guard.setRunId(7);
  await guard.finish('success', { totalItems: 1 });
  await guard.handleSignal('SIGINT');

  assert.deepEqual(calls, [
    {
      id: 7,
      status: 'success',
      details: { totalItems: 1 },
    },
  ]);
  assert.equal(exitCode, 1);
});
