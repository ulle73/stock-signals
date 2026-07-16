import test from 'node:test';
import assert from 'node:assert/strict';
import { signalControlsUnavailable } from '../lib/chart/signal-controls.js';

test('signal controls stay interactive even when the selected period has no events', () => {
  assert.deepEqual(signalControlsUnavailable([]), []);
  assert.deepEqual(signalControlsUnavailable([{ time: '2026-07-15' }]), []);
});
