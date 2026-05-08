import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPositionFactRowsFromSources } from '../lib/utils/position-facts.js';

test('buildPositionFactRowsFromSources aligns macro series as-of each market day and classifies position facts', () => {
  const benchmarkRows = [
    { date: '2026-03-31' },
    { date: '2026-04-01' },
    { date: '2026-04-02' },
  ];

  const marketSeriesRows = [
    { series_id: 'SP500', date: '2026-03-28', value: 100 },
    { series_id: 'SP500', date: '2026-03-29', value: 101 },
    { series_id: 'SP500', date: '2026-03-30', value: 102 },
    { series_id: 'SP500', date: '2026-03-31', value: 103 },
    { series_id: 'SP500', date: '2026-04-01', value: 104 },
    { series_id: 'SP500', date: '2026-04-02', value: 105 },
    { series_id: 'VIXCLS', date: '2026-03-31', value: 18 },
    { series_id: 'VIXCLS', date: '2026-04-01', value: 22 },
    { series_id: 'VIXCLS', date: '2026-04-02', value: 31 },
    { series_id: 'BAMLH0A0HYM2', date: '2026-03-31', value: 3.8 },
    { series_id: 'BAMLH0A0HYM2', date: '2026-04-01', value: 5.2 },
    { series_id: 'BAMLH0A0HYM2', date: '2026-04-02', value: 6.1 },
    { series_id: 'T10Y2Y', date: '2026-03-31', value: 0.6 },
    { series_id: 'T10Y2Y', date: '2026-04-01', value: 0.2 },
    { series_id: 'T10Y2Y', date: '2026-04-02', value: -0.3 },
    { series_id: 'FEDFUNDS', date: '2026-02-01', value: 4.5 },
    { series_id: 'FEDFUNDS', date: '2026-03-01', value: 4.75 },
    { series_id: 'FEDFUNDS', date: '2026-04-01', value: 4.5 },
    { series_id: 'UNRATE', date: '2026-02-01', value: 4.0 },
    { series_id: 'UNRATE', date: '2026-03-01', value: 4.1 },
    { series_id: 'UNRATE', date: '2026-04-01', value: 4.5 },
    { series_id: 'CPIAUCSL', date: '2025-02-01', value: 99.5 },
    { series_id: 'CPIAUCSL', date: '2025-03-01', value: 100 },
    { series_id: 'CPIAUCSL', date: '2025-04-01', value: 100 },
    { series_id: 'CPIAUCSL', date: '2025-05-01', value: 100.5 },
    { series_id: 'CPIAUCSL', date: '2025-06-01', value: 101 },
    { series_id: 'CPIAUCSL', date: '2025-07-01', value: 101.5 },
    { series_id: 'CPIAUCSL', date: '2025-08-01', value: 102 },
    { series_id: 'CPIAUCSL', date: '2025-09-01', value: 102.5 },
    { series_id: 'CPIAUCSL', date: '2025-10-01', value: 103 },
    { series_id: 'CPIAUCSL', date: '2025-11-01', value: 103.5 },
    { series_id: 'CPIAUCSL', date: '2025-12-01', value: 104 },
    { series_id: 'CPIAUCSL', date: '2026-01-01', value: 104.5 },
    { series_id: 'CPIAUCSL', date: '2026-02-01', value: 105 },
    { series_id: 'CPIAUCSL', date: '2026-03-01', value: 106 },
    { series_id: 'CPIAUCSL', date: '2026-04-01', value: 105.6 },
    { series_id: 'UMCSENT', date: '2026-02-01', value: 60 },
    { series_id: 'UMCSENT', date: '2026-03-01', value: 58 },
    { series_id: 'UMCSENT', date: '2026-04-01', value: 65 },
  ];

  const rows = buildPositionFactRowsFromSources(
    {
      benchmarkRows,
      marketSeriesRows,
    },
    {
      sp500SmaWindow: 3,
      macroTrendLookbackObservations: 1,
      cpiYoyLookbackObservations: 12,
      inflationTrendLookbackObservations: 1,
      fedFundsTrendThreshold: 0.25,
      laborTrendThreshold: 0.2,
      inflationTrendThreshold: 0.25,
      sentimentTrendThreshold: 5,
    }
  );

  assert.equal(rows.length, 3);

  const marchRow = rows[0];
  assert.equal(marchRow.date, '2026-03-31');
  assert.equal(marchRow.fed_funds_observation_date, '2026-03-01');
  assert.equal(marchRow.unemployment_observation_date, '2026-03-01');
  assert.equal(marchRow.cpi_observation_date, '2026-03-01');
  assert.equal(marchRow.consumer_sentiment_observation_date, '2026-03-01');
  assert.equal(marchRow.fed_policy_trend, 'tightening');
  assert.equal(marchRow.labor_trend, 'stable');
  assert.equal(marchRow.sentiment_trend, 'stable');

  const latest = rows.at(-1);
  assert.deepEqual(latest, {
    date: '2026-04-02',
    sp500: 105,
    sp500_200dma: 104,
    sp500_pct_from_200dma: 0.961538,
    vix: 31,
    high_yield_spread: 6.1,
    yield_curve_spread: -0.3,
    fed_funds: 4.5,
    fed_funds_change: -0.25,
    unemployment_rate: 4.5,
    unemployment_rate_change: 0.4,
    cpi_index: 105.6,
    cpi_yoy: 5.6,
    cpi_yoy_change: -0.4,
    consumer_sentiment: 65,
    consumer_sentiment_change: 7,
    sp500_observation_date: '2026-04-02',
    vix_observation_date: '2026-04-02',
    high_yield_observation_date: '2026-04-02',
    yield_curve_observation_date: '2026-04-02',
    fed_funds_observation_date: '2026-04-01',
    unemployment_observation_date: '2026-04-01',
    cpi_observation_date: '2026-04-01',
    consumer_sentiment_observation_date: '2026-04-01',
    sp500_trend_regime: 'above_200dma',
    vix_regime: 'stress',
    credit_regime: 'stress',
    yield_curve_regime: 'inverted',
    fed_policy_trend: 'easing',
    labor_trend: 'deteriorating',
    inflation_trend: 'cooling',
    sentiment_trend: 'improving',
    yield_curve_inverted: true,
  });
});
