import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGexDexSnapshotUpsertStatement,
  buildGexDexStrikeUpsertStatements,
} from '../lib/repositories/gex-dex-snapshots.js';

const sourceUrl = 'https://gammalens-api.onrender.com/api/gex/SPY';

const snapshot = {
  ticker: 'SPY',
  source_timestamp: '2026-07-10T21:32:25.175Z',
  source_url: sourceUrl,
  source_status: 'active',
  data_quality: 'premium',
  from_cache: true,
  stale: false,
  multi_expiry: true,
  spot_price: 754.95,
  spot_change: 2.3,
  spot_change_pct: 0.31,
  call_wall: 759,
  put_wall: 750,
  gamma_flip: 737.5,
  net_gex: 2012258135.78,
  net_dex: 4333241.49,
  dealer_positioning: 'POSITIVE GAMMA',
  market_regime: 'Dealers suppress moves.',
  dex_resistance: 770,
  dex_support: 750,
  atr_14: 9.5585,
  atr_pct: 1.266,
  key_levels: { trap_zone: { active: true } },
  raw_payload: { ticker: 'SPY' },
};

test('buildGexDexSnapshotUpsertStatement preserves GammaLens source metadata', () => {
  const statement = buildGexDexSnapshotUpsertStatement(snapshot);

  assert.match(statement.sql, /insert into gex_dex_source_snapshots/i);
  assert.match(statement.sql, /on conflict \(ticker, source_timestamp\)/i);
  assert.deepEqual(statement.params.slice(0, 4), [
    'SPY',
    '2026-07-10T21:32:25.175Z',
    sourceUrl,
    'active',
  ]);
  assert.deepEqual(JSON.parse(statement.params.at(-1)), { ticker: 'SPY' });
});

test('buildGexDexStrikeUpsertStatements stores the full GEX/DEX strike distribution', () => {
  const statements = buildGexDexStrikeUpsertStatements(42, [
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

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into gex_dex_strike_snapshots/i);
  assert.deepEqual(statements[0].params, ['42', '750', '12', '-8', '4', '5', '-3', '2', '3']);
});
