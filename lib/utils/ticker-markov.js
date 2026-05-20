function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(decimals));
}

function indicatorPrice(row) {
  return toNumber(row.adj_close ?? row.close ?? row.indicator_price);
}

function emptyTransitionCounts() {
  return {
    bull: { bull: 0, sideways: 0, bear: 0 },
    sideways: { bull: 0, sideways: 0, bear: 0 },
    bear: { bull: 0, sideways: 0, bear: 0 },
  };
}

function transitionProbabilities(counts, state) {
  if (!state || !counts[state]) {
    return null;
  }

  const row = counts[state];
  const sampleSize = row.bull + row.sideways + row.bear;

  if (sampleSize === 0) {
    return null;
  }

  const bullProbability = row.bull / sampleSize;
  const sidewaysProbability = row.sideways / sampleSize;
  const bearProbability = row.bear / sampleSize;

  return {
    bull_probability: round(bullProbability),
    sideways_probability: round(sidewaysProbability),
    bear_probability: round(bearProbability),
    markov_total: round(bullProbability - bearProbability),
    stickiness: round(row[state] / sampleSize),
    sample_size: sampleSize,
  };
}

function classifySignal(total, sampleSize, {
  minSampleSize = 30,
  bullThreshold = 0.3,
  bearThreshold = -0.3,
} = {}) {
  if (sampleSize < minSampleSize || total === null || total === undefined) {
    return 'neutral';
  }

  if (total >= bullThreshold) {
    return 'bull';
  }

  if (total <= bearThreshold) {
    return 'sell';
  }

  return 'neutral';
}

export function classifyTickerMarkovState(twentyDayReturn, {
  bullThreshold = 0.05,
  bearThreshold = -0.05,
} = {}) {
  if (twentyDayReturn === null || twentyDayReturn === undefined) {
    return null;
  }

  if (twentyDayReturn >= bullThreshold) {
    return 'bull';
  }

  if (twentyDayReturn <= bearThreshold) {
    return 'bear';
  }

  return 'sideways';
}

export function buildTickerMarkovRows(priceRows, {
  lookbackDays = 20,
  bullThreshold = 0.05,
  bearThreshold = -0.05,
  minSampleSize = 30,
  signalBullThreshold = 0.3,
  signalBearThreshold = -0.3,
} = {}) {
  const sortedRows = [...priceRows]
    .filter((row) => row.ticker && row.date)
    .sort((left, right) => {
      const tickerDiff = left.ticker.localeCompare(right.ticker);
      if (tickerDiff !== 0) {
        return tickerDiff;
      }

      return left.date.localeCompare(right.date);
    });

  const rowsByTicker = new Map();
  for (const row of sortedRows) {
    if (!rowsByTicker.has(row.ticker)) {
      rowsByTicker.set(row.ticker, []);
    }

    rowsByTicker.get(row.ticker).push(row);
  }

  const outputRows = [];

  for (const [ticker, rows] of rowsByTicker.entries()) {
    const stateRows = rows.map((row, index) => {
      const price = indicatorPrice(row);
      const previousPrice = index >= lookbackDays
        ? indicatorPrice(rows[index - lookbackDays])
        : null;
      const twentyDayReturn = price !== null && previousPrice !== null && previousPrice !== 0
        ? price / previousPrice - 1
        : null;

      return {
        ticker,
        date: row.date,
        price,
        twenty_day_return: round(twentyDayReturn),
        markov_state: classifyTickerMarkovState(twentyDayReturn, { bullThreshold, bearThreshold }),
      };
    });

    const counts = emptyTransitionCounts();

    for (let index = 0; index < stateRows.length; index += 1) {
      const current = stateRows[index];
      const probabilities = transitionProbabilities(counts, current.markov_state);
      const markovTotal = probabilities?.markov_total ?? null;
      const sampleSize = probabilities?.sample_size ?? 0;

      outputRows.push({
        ticker,
        date: current.date,
        markov_state: current.markov_state,
        twenty_day_return: current.twenty_day_return,
        bull_probability: probabilities?.bull_probability ?? null,
        sideways_probability: probabilities?.sideways_probability ?? null,
        bear_probability: probabilities?.bear_probability ?? null,
        markov_total: markovTotal,
        markov_stickiness: probabilities?.stickiness ?? null,
        sample_size: sampleSize,
        signal: classifySignal(markovTotal, sampleSize, {
          minSampleSize,
          bullThreshold: signalBullThreshold,
          bearThreshold: signalBearThreshold,
        }),
      });

      const next = stateRows[index + 1];
      if (current.markov_state && next?.markov_state) {
        counts[current.markov_state][next.markov_state] += 1;
      }
    }
  }

  return outputRows;
}

export function rankLatestTickerMarkovRows(rows) {
  const latestByTicker = new Map();

  for (const row of rows) {
    const current = latestByTicker.get(row.ticker);
    if (!current || row.date > current.date) {
      latestByTicker.set(row.ticker, row);
    }
  }

  const latestRows = [...latestByTicker.values()];
  const bullRows = latestRows
    .filter((row) => row.markov_total !== null && row.markov_total !== undefined)
    .sort((left, right) => Number(right.markov_total) - Number(left.markov_total));
  const sellRows = latestRows
    .filter((row) => row.markov_total !== null && row.markov_total !== undefined)
    .sort((left, right) => Number(left.markov_total) - Number(right.markov_total));

  const bullRankByTicker = new Map(bullRows.map((row, index) => [row.ticker, index + 1]));
  const sellRankByTicker = new Map(sellRows.map((row, index) => [row.ticker, index + 1]));

  return rows.map((row) => ({
    ...row,
    rank_bull: row.date === latestByTicker.get(row.ticker)?.date
      ? bullRankByTicker.get(row.ticker) ?? null
      : null,
    rank_sell: row.date === latestByTicker.get(row.ticker)?.date
      ? sellRankByTicker.get(row.ticker) ?? null
      : null,
  }));
}
