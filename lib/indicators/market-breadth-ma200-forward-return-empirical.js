import { bucketMa200Breadth } from './market-breadth-ma200-forward-return-model.js';
import { normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

export const DEFAULT_EMPIRICAL_FORWARD_LOOKAHEADS = {
  '5d': 5,
  '10d': 10,
  '1m': 21,
  '3m': 63,
  '6m': 126,
  '12m': 252,
};

export const EMPIRICAL_FORWARD_MODEL_VERSION = 'empirical_spy_v2';

function getBenchmarkPrice(row) {
  return toNumber(row.adj_close ?? row.close);
}

function calculateForwardReturnPercent(currentPrice, futurePrice) {
  if (currentPrice === null || futurePrice === null || currentPrice === 0) {
    return null;
  }

  return normalizeNumber(((futurePrice / currentPrice) - 1) * 100);
}

function createEmptyBucketAccumulator(labels) {
  return Object.fromEntries(
    labels.map((label) => [
      label,
      { count: 0, sum: 0, wins: 0 },
    ])
  );
}

function buildBenchmarkSeries(benchmarkRows) {
  const sortedRows = sortRowsByDate(benchmarkRows)
    .map((row) => ({
      date: row.date,
      price: getBenchmarkPrice(row),
    }))
    .filter((row) => row.price !== null);

  return {
    rows: sortedRows,
    indexByDate: new Map(sortedRows.map((row, index) => [row.date, index])),
  };
}

function buildContributionRows({ breadthRows, benchmarkRows, forwardLookaheads }) {
  const labels = Object.keys(forwardLookaheads);
  const sortedBreadthRows = sortRowsByDate(breadthRows);
  const benchmarkSeries = buildBenchmarkSeries(benchmarkRows);
  const signalRows = [];
  const contributions = [];

  for (const breadthRow of sortedBreadthRows) {
    const ma200BreadthPct = toNumber(breadthRow.pct_above_sma200);
    if (!breadthRow.is_valid_signal_date || ma200BreadthPct === null) {
      continue;
    }

    const ma200BreadthBucket = bucketMa200Breadth(ma200BreadthPct);
    const benchmarkIndex = benchmarkSeries.indexByDate.get(breadthRow.date);

    if (!ma200BreadthBucket || benchmarkIndex === undefined) {
      continue;
    }

    signalRows.push({
      date: breadthRow.date,
      ma200_breadth_pct: normalizeNumber(ma200BreadthPct),
      ma200_breadth_bucket: ma200BreadthBucket,
    });

    const currentPrice = benchmarkSeries.rows[benchmarkIndex].price;

    for (const label of labels) {
      const futureRow = benchmarkSeries.rows[benchmarkIndex + forwardLookaheads[label]];
      if (!futureRow) {
        continue;
      }

      const forwardReturnPercent = calculateForwardReturnPercent(currentPrice, futureRow.price);
      if (forwardReturnPercent === null) {
        continue;
      }

      contributions.push({
        maturityDate: futureRow.date,
        ma200_breadth_bucket: ma200BreadthBucket,
        label,
        forwardReturnPercent,
      });
    }
  }

  contributions.sort((left, right) => left.maturityDate.localeCompare(right.maturityDate));

  return { labels, signalRows, contributions };
}

function buildEmpiricalStatsRow({ signalRow, benchmarkSymbol, labels, bucketAccumulators }) {
  const row = {
    date: signalRow.date,
    benchmark_symbol: benchmarkSymbol,
    ma200_breadth_pct: signalRow.ma200_breadth_pct,
    ma200_breadth_bucket: signalRow.ma200_breadth_bucket,
    ma200_forward_model_version: EMPIRICAL_FORWARD_MODEL_VERSION,
  };

  const bucketAccumulator = bucketAccumulators.get(signalRow.ma200_breadth_bucket) ?? createEmptyBucketAccumulator(labels);

  for (const label of labels) {
    const accumulator = bucketAccumulator[label];
    row[`ma200_empirical_sample_count_${label}`] = accumulator.count;
    row[`ma200_empirical_expected_return_${label}`] = accumulator.count > 0
      ? normalizeNumber(accumulator.sum / accumulator.count)
      : null;
    row[`ma200_empirical_win_ratio_${label}`] = accumulator.count > 0
      ? normalizeNumber((accumulator.wins / accumulator.count) * 100)
      : null;
  }

  return row;
}

export function buildMa200BreadthForwardReturnEmpiricalRows({
  breadthRows,
  benchmarkRows,
  benchmarkSymbol = 'SPY',
  forwardLookaheads = DEFAULT_EMPIRICAL_FORWARD_LOOKAHEADS,
}) {
  const { labels, signalRows, contributions } = buildContributionRows({
    breadthRows,
    benchmarkRows,
    forwardLookaheads,
  });
  const bucketAccumulators = new Map();
  const empiricalRows = [];
  let contributionIndex = 0;

  for (const signalRow of signalRows) {
    while (
      contributionIndex < contributions.length &&
      contributions[contributionIndex].maturityDate.localeCompare(signalRow.date) <= 0
    ) {
      const contribution = contributions[contributionIndex];
      const bucketAccumulator = bucketAccumulators.get(contribution.ma200_breadth_bucket)
        ?? createEmptyBucketAccumulator(labels);
      const horizonAccumulator = bucketAccumulator[contribution.label];

      horizonAccumulator.count += 1;
      horizonAccumulator.sum += contribution.forwardReturnPercent;
      horizonAccumulator.wins += contribution.forwardReturnPercent > 0 ? 1 : 0;

      bucketAccumulators.set(contribution.ma200_breadth_bucket, bucketAccumulator);
      contributionIndex += 1;
    }

    empiricalRows.push(
      buildEmpiricalStatsRow({
        signalRow,
        benchmarkSymbol,
        labels,
        bucketAccumulators,
      })
    );
  }

  return empiricalRows;
}
