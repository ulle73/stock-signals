import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fetchScriptSource = readFileSync(
  new URL('../scripts/fetch-gex-dex.js', import.meta.url),
  'utf8'
);
const workflowSource = readFileSync(
  new URL('../.github/workflows/gex-dex-snapshots.yml', import.meta.url),
  'utf8'
);

test('GEX DEX fetch combines SPY and QQQ with a dynamic top-30 volume universe', () => {
  assert.match(fetchScriptSource, /getTopVolumeGexDexTickers/);
  assert.match(fetchScriptSource, /GEX_DEX_TOP_VOLUME_LIMIT/);
  assert.match(fetchScriptSource, /GEX_DEX_TOP_VOLUME_LOOKBACK/);
  assert.match(fetchScriptSource, /mergeGexDexTickerUniverse/);

  assert.match(workflowSource, /GEX_DEX_TICKERS:\s*'SPY,QQQ'/);
  assert.match(workflowSource, /GEX_DEX_TOP_VOLUME_LIMIT:\s*'30'/);
  assert.match(workflowSource, /GEX_DEX_TOP_VOLUME_LOOKBACK:\s*'20'/);
  assert.match(workflowSource, /GEX_DEX_FETCH_CONCURRENCY:\s*'4'/);
});
