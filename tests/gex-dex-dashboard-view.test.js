import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGexDexDashboardView } from '../lib/utils/gex-dex-dashboard-view.js';

const snapshots = [
  {
    id: 42,
    ticker: 'SPY',
    source_timestamp: '2026-07-10T21:32:25.175Z',
    source_url: 'https://gammalens-api.onrender.com/api/gex/SPY',
    source_status: 'active',
    data_quality: 'premium',
    from_cache: true,
    stale: false,
    multi_expiry: true,
    spot_price: '100',
    spot_change: '0.31',
    spot_change_pct: '0.31',
    call_wall: '105',
    put_wall: '95',
    gamma_flip: '90',
    net_gex: '1000000',
    net_dex: '10000',
    dealer_positioning: 'POSITIVE GAMMA',
    market_regime: 'Dealers suppress moves.',
    dex_resistance: '106',
    dex_support: '94',
    atr_14: '4',
    atr_pct: '1.2',
    gamma_regime: 'positive',
    spot_to_gamma_flip_atr: '2.5',
    spot_to_call_wall_atr: '-1.25',
    spot_to_put_wall_atr: '1.25',
    inside_walls: true,
    near_gamma_flip: false,
    above_call_wall: false,
    below_put_wall: false,
    gex_dex_confluence: true,
    gex_dex_signal: 'range',
  },
];

const strikes = [
  { snapshot_id: 42, strike: '95', net_gex: '-10', net_dex: '-4' },
  { snapshot_id: 42, strike: '100', net_gex: '20', net_dex: '8' },
  { snapshot_id: 42, strike: '105', net_gex: '5', net_dex: '2' },
];

test('buildGexDexDashboardView exposes a current positioning map and normalizes strike bars', () => {
  const view = buildGexDexDashboardView(snapshots, strikes);

  assert.equal(view.cards.length, 1);
  assert.equal(view.cards[0].ticker, 'SPY');
  assert.equal(view.cards[0].signal.key, 'range');
  assert.equal(view.cards[0].signal.label, 'Range');
  assert.equal(view.cards[0].signal.tone, 'positive');
  assert.equal(view.cards[0].freshness.label, 'Aktiv');
  assert.equal(view.cards[0].strikes[1].strike, 100);
  assert.equal(view.cards[0].strikes[1].gexBarPct, 100);
  assert.equal(view.cards[0].strikes[1].dexBarPct, 100);
  assert.equal(view.cards[0].levels[0].key, 'call_wall');
  assert.equal(view.cards[0].levels.at(-1).key, 'gamma_flip');
});

test('buildGexDexDashboardView makes provider-stale data visibly unavailable for decisions', () => {
  const view = buildGexDexDashboardView([
    { ...snapshots[0], stale: true, source_status: 'stale', gex_dex_signal: 'unknown' },
  ], strikes);

  assert.equal(view.cards[0].freshness.label, 'Inaktuell källa');
  assert.equal(view.cards[0].signal.label, 'Ingen bedömning');
});
