import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { getPriceHistoryForIndicators } from '../lib/repositories/indicators.js';
import { upsertTickerMarkovRows } from '../lib/repositories/ticker-markov.js';
import { buildTickerMarkovRows, rankLatestTickerMarkovRows } from '../lib/utils/ticker-markov.js';

ensureEnvLoaded();

function getOptions() {
  const ticker = process.env.CALCULATE_TICKER?.trim().toUpperCase() || null;
  const parsedLimit = process.env.CALCULATE_TICKER_LIMIT
    ? Number(process.env.CALCULATE_TICKER_LIMIT)
    : null;
  const tickerLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
  return { ticker, tickerLimit };
}

async function run() {
  const priceRows = await getPriceHistoryForIndicators(getOptions());
  if (!priceRows.length) {
    throw new Error('No stock price history found.');
  }

  const markovRows = buildTickerMarkovRows(priceRows);
  const rankedRows = rankLatestTickerMarkovRows(markovRows);
  const upserted = await upsertTickerMarkovRows(rankedRows);
  const latestRows = rankedRows.filter((row) => row.rank_bull !== null || row.rank_sell !== null);

  console.log(`Ticker Markov rows upserted: ${upserted}`);
  console.log(`Latest ticker Markov rows ranked: ${latestRows.length}`);
}

run()
  .catch((error) => {
    console.error('calculate:ticker-markov failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
