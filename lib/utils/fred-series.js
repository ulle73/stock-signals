import { filterIncrementalRows } from './incremental-fetch.js';

export const FRED_SERIES_DEFINITIONS = [
  { seriesId: 'SP500', cadence: 'daily', domain: 'market' },
  { seriesId: 'VIXCLS', cadence: 'daily', domain: 'market' },
  { seriesId: 'BAMLH0A0HYM2', cadence: 'daily', domain: 'credit' },
  { seriesId: 'T10Y2Y', cadence: 'daily', domain: 'rates' },
  { seriesId: 'FEDFUNDS', cadence: 'monthly', domain: 'rates' },
  { seriesId: 'UNRATE', cadence: 'monthly', domain: 'labor' },
  { seriesId: 'CPIAUCSL', cadence: 'monthly', domain: 'inflation' },
  { seriesId: 'UMCSENT', cadence: 'monthly', domain: 'sentiment' },
];

export const FRED_SERIES_IDS = FRED_SERIES_DEFINITIONS.map((item) => item.seriesId);

export function filterFredRowsForUpsert(definition, rows, latestDate) {
  if (!latestDate) {
    return rows;
  }

  if (definition.cadence === 'monthly') {
    return rows;
  }

  return filterIncrementalRows(rows, latestDate);
}
