import test from 'node:test';
import assert from 'node:assert/strict';
import { FRED_SERIES_DEFINITIONS, FRED_SERIES_IDS } from '../lib/utils/fred-series.js';

test('FRED series config includes all market and macro series needed for the position system', () => {
  assert.deepEqual(FRED_SERIES_IDS, [
    'SP500',
    'VIXCLS',
    'BAMLH0A0HYM2',
    'T10Y2Y',
    'FEDFUNDS',
    'UNRATE',
    'CPIAUCSL',
    'UMCSENT',
  ]);

  assert.deepEqual(
    FRED_SERIES_DEFINITIONS.map((item) => ({
      seriesId: item.seriesId,
      cadence: item.cadence,
      domain: item.domain,
    })),
    [
      { seriesId: 'SP500', cadence: 'daily', domain: 'market' },
      { seriesId: 'VIXCLS', cadence: 'daily', domain: 'market' },
      { seriesId: 'BAMLH0A0HYM2', cadence: 'daily', domain: 'credit' },
      { seriesId: 'T10Y2Y', cadence: 'daily', domain: 'rates' },
      { seriesId: 'FEDFUNDS', cadence: 'monthly', domain: 'rates' },
      { seriesId: 'UNRATE', cadence: 'monthly', domain: 'labor' },
      { seriesId: 'CPIAUCSL', cadence: 'monthly', domain: 'inflation' },
      { seriesId: 'UMCSENT', cadence: 'monthly', domain: 'sentiment' },
    ]
  );
});
