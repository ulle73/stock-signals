import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadTickerOptionModule() {
  try {
    return await import('../lib/chart/chart-ticker-options.js');
  } catch {
    return {};
  }
}

test('chart ticker options pin SPY and QQQ before the shared top-volume universe', async () => {
  const module = await loadTickerOptionModule();
  assert.equal(typeof module.buildChartTickerOptions, 'function');

  const options = module.buildChartTickerOptions({
    constituents: [
      { ticker: 'AMD', company_name: 'Advanced Micro Devices' },
      { ticker: 'AAPL', company_name: 'Apple Inc.' },
      { ticker: 'MSFT', company_name: 'Microsoft Corp.' },
      { ticker: 'NVDA', company_name: 'NVIDIA Corp.' },
    ],
    featuredTickers: ['NVDA', 'AMD', 'NVDA'],
  });

  assert.deepEqual(options.map((item) => item.ticker), [
    'SPY', 'QQQ', 'NVDA', 'AMD', 'AAPL', 'MSFT',
  ]);
  assert.equal(options[0].company_name, 'SPDR S&P 500 ETF Trust');
  assert.equal(options[1].company_name, 'Invesco QQQ Trust');
  assert.deepEqual(options.map((item) => item.featured), [true, true, true, true, false, false]);
  assert.equal(new Set(options.map((item) => item.ticker)).size, options.length);
});

test('chart benchmark definitions identify SPY and QQQ as benchmark price sources', async () => {
  const module = await loadTickerOptionModule();
  assert.equal(typeof module.getChartBenchmarkDefinition, 'function');
  assert.equal(module.getChartBenchmarkDefinition('spy')?.price_source, 'benchmark');
  assert.equal(module.getChartBenchmarkDefinition('QQQ')?.ticker, 'QQQ');
  assert.equal(module.getChartBenchmarkDefinition('AMD'), null);
});

test('chart page, chart data and daily fetch use the shared benchmark universe', async () => {
  const [page, chartData, fetchDaily] = await Promise.all([
    readFile(new URL('../app/chart/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../lib/repositories/chart-data.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/fetch-daily.js', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /getChartTickerOptions/);
  assert.match(chartData, /getChartBenchmarkDefinition/);
  assert.match(chartData, /benchmark_daily_prices/);
  assert.match(fetchDaily, /BENCHMARK_TICKERS\s*=\s*\['SPY',\s*'QQQ'\]/);
});

test('ticker selector groups prioritized GEX DEX instruments above the remaining S&P 500 list', async () => {
  const toolbar = await readFile(new URL('../app/chart/chart-toolbar.js', import.meta.url), 'utf8');
  assert.match(toolbar, /Prioriterade GEX\/DEX/);
  assert.match(toolbar, /Övriga S&P 500/);
  assert.match(toolbar, /item\.featured/);
});
