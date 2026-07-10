import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGammaLensGexDexUrl,
  parseGammaLensGexDexPayload,
  resolveGammaLensGexDexTickers,
} from '../lib/sources/gammalens-gex-dex.js';

const payload = {
  ticker: 'SPY',
  key_levels: {
    spot_price: 754.95,
    call_wall: 759,
    call_wall_gex: 418181692.94,
    put_wall: 750,
    put_wall_gex: -210277887.11,
    gamma_flip: 737.5,
    net_gex: 2012258135.78,
    total_call_gex: 3223634514,
    total_put_gex: -1211376378.22,
    dealer_positioning: 'POSITIVE GAMMA',
    market_regime: 'Dealers suppress moves.',
    stacking_levels: [{ strike: 759, expiry_count: 3, net_gex: 416021353.68 }],
    dex_resistance: 770,
    dex_resistance_value: -10693.3,
    dex_support: 750,
    dex_support_value: 448036.96,
    net_dex: 4333241.49,
    expiry_breakdown: { '2026-07-14': { net_gex: 699933160.69 } },
    trap_zone: { active: true, low: 750, high: 759, bias: 'bullish' },
    atr_14: 9.5585,
    atr_pct: 1.266,
  },
  strikes: [
    {
      strike: 750,
      call_gex: 12,
      put_gex: -8,
      net_gex: 4,
      call_dex: 5,
      put_dex: -3,
      net_dex: 2,
      expiry_count: 3,
    },
  ],
  all_strikes: false,
  multi_expiry: true,
  data_quality: 'premium',
  timestamp: '2026-07-10T21:32:25.175289+00:00',
  spot_change: 2.3,
  spot_changepct: 0.31,
  from_cache: true,
  stale: false,
};

test('buildGammaLensGexDexUrl encodes an upper-case ticker', () => {
  assert.equal(
    buildGammaLensGexDexUrl('brk.b'),
    'https://gammalens-api.onrender.com/api/gex/BRK.B'
  );
});

test('resolveGammaLensGexDexTickers defaults to SPY and QQQ and normalizes configured values', () => {
  assert.deepEqual(resolveGammaLensGexDexTickers(''), ['SPY', 'QQQ']);
  assert.deepEqual(resolveGammaLensGexDexTickers('spy, qqq, SPY'), ['SPY', 'QQQ']);
});

test('parseGammaLensGexDexPayload normalizes a source snapshot and per-strike GEX/DEX rows', () => {
  const result = parseGammaLensGexDexPayload('SPY', payload);

  assert.equal(result.snapshot.ticker, 'SPY');
  assert.equal(result.snapshot.source_timestamp, '2026-07-10T21:32:25.175Z');
  assert.equal(result.snapshot.spot_price, 754.95);
  assert.equal(result.snapshot.gamma_flip, 737.5);
  assert.equal(result.snapshot.source_status, 'active');
  assert.equal(result.snapshot.source_url, 'https://gammalens-api.onrender.com/api/gex/SPY');
  assert.deepEqual(result.snapshot.key_levels, payload.key_levels);
  assert.deepEqual(result.snapshot.raw_payload, payload);
  assert.deepEqual(result.strikes, [
    {
      strike: 750,
      call_gex: 12,
      put_gex: -8,
      net_gex: 4,
      call_dex: 5,
      put_dex: -3,
      net_dex: 2,
      expiry_count: 3,
    },
  ]);
});

test('parseGammaLensGexDexPayload preserves stale provider snapshots without treating them as active', () => {
  const result = parseGammaLensGexDexPayload('SPY', { ...payload, stale: true });

  assert.equal(result.snapshot.source_status, 'stale');
  assert.equal(result.snapshot.stale, true);
});

test('parseGammaLensGexDexPayload rejects malformed or mismatched provider payloads', () => {
  assert.throws(
    () => parseGammaLensGexDexPayload('SPY', { ...payload, strikes: [] }),
    /at least one valid strike/i
  );
  assert.throws(
    () => parseGammaLensGexDexPayload('QQQ', payload),
    /ticker mismatch/i
  );
});
