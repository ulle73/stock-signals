import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSignalDataQualityRows } from '../lib/utils/data-quality-gates.js';

function getGate(rows, gateKey) {
  return rows.find((row) => row.gate_key === gateKey);
}

test('buildSignalDataQualityRows marks all gates pass when datasets are current and complete', () => {
  const rows = buildSignalDataQualityRows({
    activeTickerCount: 500,
    latestPriceDate: '2026-06-26',
    priceTickerCountForDate: 500,
    latestBenchmarkDate: '2026-06-26',
    latestMarketSignalDate: '2026-06-26',
    latestRelativeStrengthDate: '2026-06-26',
    relativeStrengthTickerCountForDate: 500,
    latestIntradaySessionDate: '2026-06-26',
    intradayTickerCountForDate: 500,
    latestOccReportDate: '2026-06-26',
    latestFinraDate: '2026-06-26',
    latestIvolDate: '2026-06-26',
    ivolTotalCount: 17,
    ivolActiveCount: 17,
    ivolMissingAssetKeys: [],
  }, { expectedDate: '2026-06-26' });

  assert.equal(rows.length, 11);
  assert.ok(rows.every((row) => row.status === 'pass'));

  assert.deepEqual(getGate(rows, 'stock_daily_price_coverage').details, {
    observed_count: 500,
    expected_count: 500,
    coverage_ratio: 1,
    coverage_percent: 100,
    pass_coverage_threshold: 1,
    warn_coverage_threshold: 0.95,
    expected_date: '2026-06-26',
  });
});

test('buildSignalDataQualityRows blocks stale core layers and distinguishes warning vs blocking auxiliary gates', () => {
  const rows = buildSignalDataQualityRows({
    activeTickerCount: 500,
    latestPriceDate: '2026-06-23',
    priceTickerCountForDate: 490,
    latestBenchmarkDate: '2026-06-24',
    latestMarketSignalDate: '2026-06-23',
    latestRelativeStrengthDate: '2026-06-24',
    relativeStrengthTickerCountForDate: 470,
    latestIntradaySessionDate: '2026-06-24',
    intradayTickerCountForDate: 390,
    latestOccReportDate: '2026-06-23',
    latestFinraDate: '2026-06-20',
    latestIvolDate: '2026-06-23',
    ivolTotalCount: 17,
    ivolActiveCount: 15,
    ivolMissingAssetKeys: ['gdx_gold_miners', 'gld_gold'],
  }, { expectedDate: '2026-06-24' });

  assert.equal(getGate(rows, 'stock_daily_prices_freshness').status, 'block');
  assert.equal(getGate(rows, 'stock_daily_prices_freshness').details.stale_by_market_days, 1);

  assert.equal(getGate(rows, 'market_signal_freshness').status, 'block');
  assert.equal(getGate(rows, 'relative_strength_freshness').status, 'pass');

  assert.equal(getGate(rows, 'stock_daily_price_coverage').status, 'warn');
  assert.equal(getGate(rows, 'stock_daily_price_coverage').details.coverage_percent, 98);

  assert.equal(getGate(rows, 'relative_strength_coverage').status, 'block');
  assert.equal(getGate(rows, 'relative_strength_coverage').details.coverage_percent, 94);

  assert.equal(getGate(rows, 'intraday_60m_coverage').status, 'block');
  assert.equal(getGate(rows, 'occ_volume_totals_freshness').status, 'warn');
  assert.equal(getGate(rows, 'finra_short_volume_freshness').status, 'block');
  assert.equal(getGate(rows, 'ivol_rvol_freshness').status, 'warn');

  const ivolSourceStatus = getGate(rows, 'ivol_rvol_source_status');
  assert.equal(ivolSourceStatus.status, 'warn');
  assert.deepEqual(ivolSourceStatus.details.missing_asset_keys, ['gdx_gold_miners', 'gld_gold']);
});

test('buildSignalDataQualityRows blocks missing snapshots explicitly', () => {
  const rows = buildSignalDataQualityRows({
    activeTickerCount: 500,
    latestPriceDate: null,
    priceTickerCountForDate: 0,
    latestBenchmarkDate: null,
    latestMarketSignalDate: null,
    latestRelativeStrengthDate: null,
    relativeStrengthTickerCountForDate: 0,
    latestIntradaySessionDate: null,
    intradayTickerCountForDate: 0,
    latestOccReportDate: null,
    latestFinraDate: null,
    latestIvolDate: null,
    ivolTotalCount: 0,
    ivolActiveCount: 0,
    ivolMissingAssetKeys: [],
  }, { expectedDate: '2026-06-24' });

  assert.equal(getGate(rows, 'stock_daily_prices_freshness').reason_code, 'missing');
  assert.equal(getGate(rows, 'intraday_60m_coverage').reason_code, 'missing');
  assert.equal(getGate(rows, 'ivol_rvol_source_status').reason_code, 'missing_snapshot');
});
