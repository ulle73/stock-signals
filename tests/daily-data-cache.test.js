import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyDataCacheHeaders } from '../lib/utils/daily-data-cache.js';

test('daily API cache keeps a browser response for an hour and an edge response for six hours', () => {
  const headers = buildDailyDataCacheHeaders();

  assert.equal(
    headers['Cache-Control'],
    'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400'
  );
  assert.equal(headers['CDN-Cache-Control'], headers['Cache-Control']);
  assert.equal(headers['Vercel-CDN-Cache-Control'], headers['Cache-Control']);
});
