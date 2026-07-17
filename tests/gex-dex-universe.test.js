import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTopVolumeGexDexTickerStatement,
  getTopVolumeGexDexTickers,
  mergeGexDexTickerUniverse,
} from '../lib/repositories/gex-dex-universe.js';

test('buildTopVolumeGexDexTickerStatement ranks active S&P 500 stocks by trailing share volume', () => {
  const statement = buildTopVolumeGexDexTickerStatement({
    limit: 30,
    lookbackSessions: 20,
  });

  assert.deepEqual(statement.params, [20, 30]);
  assert.match(statement.sql, /from sp500_constituents c/i);
  assert.match(statement.sql, /cross join lateral/i);
  assert.match(statement.sql, /where c\.is_active = true/i);
  assert.match(statement.sql, /order by avg\(recent\.volume\) desc/i);
  assert.match(statement.sql, /limit \$2/i);
});

test('getTopVolumeGexDexTickers normalizes database rows and removes duplicates', async () => {
  const tickers = await getTopVolumeGexDexTickers({
    queryFn: async () => ({
      rows: [{ ticker: 'nvda' }, { ticker: 'AMD' }, { ticker: 'NVDA' }, { ticker: null }],
    }),
  });

  assert.deepEqual(tickers, ['NVDA', 'AMD']);
});

test('mergeGexDexTickerUniverse keeps configured ETFs first and deduplicates top-volume stocks', () => {
  assert.deepEqual(
    mergeGexDexTickerUniverse(['SPY', 'QQQ'], ['NVDA', 'AMD', 'SPY', 'nvda']),
    ['SPY', 'QQQ', 'NVDA', 'AMD']
  );
});
