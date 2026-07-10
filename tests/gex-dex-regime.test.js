import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGexDexRegimeRows } from '../lib/indicators/gex-dex-regime.js';

function snapshot(overrides = {}) {
  return {
    id: 1,
    ticker: 'SPY',
    source_status: 'active',
    stale: false,
    spot_price: '100',
    call_wall: '105',
    put_wall: '95',
    gamma_flip: '90',
    dealer_positioning: 'POSITIVE GAMMA',
    dex_resistance: '106',
    dex_support: '94',
    atr_14: '4',
    ...overrides,
  };
}

test('buildGexDexRegimeRows marks positive gamma inside aligned walls as range', () => {
  const row = buildGexDexRegimeRows([snapshot()])[0];

  assert.equal(row.gex_dex_signal, 'range');
  assert.equal(row.gamma_regime, 'positive');
  assert.equal(row.inside_walls, true);
  assert.equal(row.near_gamma_flip, false);
  assert.equal(row.gex_dex_confluence, true);
  assert.equal(row.spot_to_call_wall_atr, -1.25);
  assert.equal(row.spot_to_put_wall_atr, 1.25);
});

test('buildGexDexRegimeRows prioritizes flip risk over a range state', () => {
  const row = buildGexDexRegimeRows([snapshot({ gamma_flip: '101' })])[0];

  assert.equal(row.gex_dex_signal, 'flip_risk');
  assert.equal(row.near_gamma_flip, true);
  assert.equal(row.spot_to_gamma_flip_atr, -0.25);
});

test('buildGexDexRegimeRows marks a negative-gamma wall break as expansion', () => {
  const row = buildGexDexRegimeRows([
    snapshot({
      spot_price: '107',
      dealer_positioning: 'NEGATIVE GAMMA',
      gamma_flip: '100',
    }),
  ])[0];

  assert.equal(row.gex_dex_signal, 'expansion');
  assert.equal(row.gamma_regime, 'negative');
  assert.equal(row.above_call_wall, true);
  assert.equal(row.inside_walls, false);
});

test('buildGexDexRegimeRows marks stale source data as unknown instead of emitting a regime', () => {
  const row = buildGexDexRegimeRows([snapshot({ stale: true, source_status: 'stale' })])[0];

  assert.equal(row.gex_dex_signal, 'unknown');
  assert.equal(row.gamma_regime, 'positive');
});
