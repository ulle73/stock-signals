import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import {
  getTickerMarkovStudySourceRows,
  replaceTickerMarkovStrategyStudyRows,
} from '../lib/repositories/ticker-markov-strategy-studies.js';
import { buildTickerMarkovStrategyStudy } from '../lib/utils/ticker-markov-strategy-study.js';

ensureEnvLoaded();

function getSpreadBps() {
  const parsed = process.env.TICKER_MARKOV_STUDY_SPREAD_BPS
    ? Number(process.env.TICKER_MARKOV_STUDY_SPREAD_BPS)
    : 10;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
}

async function run() {
  const spreadBps = getSpreadBps();
  const sourceRows = await getTickerMarkovStudySourceRows();

  if (!sourceRows.priceRows.length) {
    throw new Error('No stock price rows found.');
  }

  if (!sourceRows.markovRows.length) {
    throw new Error('No ticker Markov rows found. Run npm run calculate:ticker-markov first.');
  }

  const study = buildTickerMarkovStrategyStudy({
    ...sourceRows,
    spreadBps,
  });
  const result = await replaceTickerMarkovStrategyStudyRows(study);

  console.log(`Ticker Markov strategy daily rows: ${result.dailyRows}`);
  console.log(`Ticker Markov strategy summaries: ${result.summaries}`);
  console.log(`Spread bps: ${spreadBps}`);
}

run()
  .catch((error) => {
    console.error('study:ticker-markov failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
