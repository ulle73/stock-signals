import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGexDexSignalUpsertStatements } from '../lib/repositories/gex-dex-signals.js';

test('buildGexDexSignalUpsertStatements stores contextual GEX/DEX state by source snapshot', () => {
  const statements = buildGexDexSignalUpsertStatements([
    {
      snapshot_id: 42,
      ticker: 'SPY',
      gamma_regime: 'positive',
      spot_to_gamma_flip_atr: 1.25,
      spot_to_call_wall_atr: -0.5,
      spot_to_put_wall_atr: 0.75,
      inside_walls: true,
      near_gamma_flip: false,
      above_call_wall: false,
      below_put_wall: false,
      gex_dex_confluence: true,
      gex_dex_signal: 'range',
    },
  ]);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into gex_dex_signal_snapshots/i);
  assert.deepEqual(statements[0].params, [
    '42',
    'SPY',
    'positive',
    '1.25',
    '-0.5',
    '0.75',
    true,
    false,
    false,
    false,
    true,
    'range',
  ]);
});
