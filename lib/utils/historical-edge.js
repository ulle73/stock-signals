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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function emptyTransitionCounts() {
  return {
    bull: { bull: 0, sideways: 0, bear: 0 },
    sideways: { bull: 0, sideways: 0, bear: 0 },
    bear: { bull: 0, sideways: 0, bear: 0 },
  };
}

function getTransitionProbabilities(counts, state) {
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
    edge: round(bullProbability - bearProbability),
    stickiness: round(row[state] / sampleSize),
    sample_size: sampleSize,
  };
}

function avg(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentileRank(sortedValues, value) {
  if (!sortedValues.length || value === null || value === undefined) {
    return null;
  }

  const lessOrEqual = sortedValues.filter((candidate) => candidate <= value).length;
  return lessOrEqual / sortedValues.length;
}

function getForwardReturnStats(history, fingerprint) {
  const matches = history.filter((entry) => entry.fingerprint === fingerprint && entry.forward_5d_return !== null);
  const forward5Returns = matches.map((entry) => entry.forward_5d_return);
  const forward20Returns = matches
    .map((entry) => entry.forward_20d_return)
    .filter((value) => value !== null);

  if (!forward5Returns.length) {
    return null;
  }

  const forward5WinRate = forward5Returns.filter((value) => value > 0).length / forward5Returns.length;
  const forward20WinRate = forward20Returns.length
    ? forward20Returns.filter((value) => value > 0).length / forward20Returns.length
    : null;

  return {
    forward_5d_avg_return: round(avg(forward5Returns)),
    forward_5d_win_rate: round(forward5WinRate),
    forward_20d_avg_return: round(avg(forward20Returns)),
    forward_20d_win_rate: round(forward20WinRate),
    forward_sample_size: forward5Returns.length,
  };
}

function getHistoricalDurations(history, state) {
  const durations = [];
  let activeState = null;
  let activeDuration = 0;

  for (const entry of history) {
    if (!entry.markov_state) {
      continue;
    }

    if (entry.markov_state !== activeState) {
      if (activeState === state && activeDuration > 0) {
        durations.push(activeDuration);
      }

      activeState = entry.markov_state;
      activeDuration = 1;
      continue;
    }

    activeDuration += 1;
  }

  if (activeState === state && activeDuration > 0) {
    durations.push(activeDuration);
  }

  return durations.sort((a, b) => a - b);
}

export function classifyMarkovState(twentyDayReturn, {
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

export function buildHistoricalEdgeFingerprint(row) {
  const marketRegimeScore = toNumber(row.market_regime_score);
  const spx14dChange = toNumber(row.spx_14d_change);
  const pctAbove50 = toNumber(row.pct_above_50);
  const vix = toNumber(row.vix);
  const advancers = Number(row.advancers);
  const decliners = Number(row.decliners);

  let trendState = 'neutral';
  if (marketRegimeScore >= 4 || spx14dChange >= 2) {
    trendState = 'bull';
  } else if (marketRegimeScore <= -2 || spx14dChange <= -2) {
    trendState = 'bear';
  }

  let breadthState = 'mixed';
  if (pctAbove50 >= 60 && advancers > decliners) {
    breadthState = 'strong';
  } else if (pctAbove50 <= 45 && advancers < decliners) {
    breadthState = 'weak';
  } else if (pctAbove50 >= 50 && advancers >= decliners) {
    breadthState = 'improving';
  } else if (pctAbove50 < 50 && advancers < decliners) {
    breadthState = 'deteriorating';
  }

  let volatilityState = 'normal';
  if (vix >= 30) {
    volatilityState = 'panic';
  } else if (vix >= 25) {
    volatilityState = 'elevated';
  } else if (vix < 20) {
    volatilityState = 'calm';
  }

  return `${trendState}_${breadthState}_${volatilityState}`;
}

function classifyHistoricalEdgeDirection({ markov, forwardStats, stateDurationPercentile }) {
  const markovEdge = toNumber(markov?.edge);
  const forward5AvgReturn = toNumber(forwardStats?.forward_5d_avg_return);
  const forward5WinRate = toNumber(forwardStats?.forward_5d_win_rate);
  const sampleSize = Number(markov?.sample_size ?? 0);
  const forwardSampleSize = Number(forwardStats?.forward_sample_size ?? 0);

  const hasEnoughMarkov = sampleSize >= 30;
  const hasEnoughForward = forwardSampleSize >= 20;
  const bullEdge =
    hasEnoughMarkov &&
    markovEdge >= 0.3 &&
    toNumber(markov?.bull_probability) >= 0.52;
  const bearEdge =
    hasEnoughMarkov &&
    markovEdge <= -0.3 &&
    toNumber(markov?.bear_probability) >= 0.52;
  const forwardBullEdge =
    hasEnoughForward &&
    forward5AvgReturn > 0 &&
    forward5WinRate >= 0.55;
  const forwardBearEdge =
    hasEnoughForward &&
    forward5AvgReturn < 0 &&
    forward5WinRate <= 0.45;
  const exhaustionRisk = stateDurationPercentile !== null && stateDurationPercentile >= 0.9;

  if (bearEdge && (forwardBearEdge || markov?.state === 'bear')) {
    return 'bearish';
  }

  if (bullEdge && forwardBullEdge && !(exhaustionRisk && markovEdge < 0.15)) {
    return 'bullish';
  }

  if (markov?.state === 'bull' && exhaustionRisk && markovEdge < 0.15) {
    return 'risk_off';
  }

  return 'neutral';
}

function scoreHistoricalEdge({ markov, forwardStats, stateDurationPercentile }) {
  const markovEdge = toNumber(markov?.edge) ?? 0;
  const forwardReturn = toNumber(forwardStats?.forward_5d_avg_return) ?? 0;
  const forwardWinRate = toNumber(forwardStats?.forward_5d_win_rate);
  const winRateEdge = forwardWinRate === null ? 0 : forwardWinRate - 0.5;
  const durationPenalty = stateDurationPercentile !== null && stateDurationPercentile > 0.85
    ? (stateDurationPercentile - 0.85) * 0.75
    : 0;

  return round(clamp(markovEdge + winRateEdge + forwardReturn * 10 - durationPenalty, -1, 1));
}

export function buildHistoricalEdgeByDate(rows, {
  lookbackDays = 20,
  bullThreshold = 0.05,
  bearThreshold = -0.05,
} = {}) {
  const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const enrichedRows = sortedRows.map((row, index) => {
    const close = toNumber(row.spx_close);
    const previousClose = index >= lookbackDays
      ? toNumber(sortedRows[index - lookbackDays].spx_close)
      : null;
    const close5dForward = index + 5 < sortedRows.length
      ? toNumber(sortedRows[index + 5].spx_close)
      : null;
    const close20dForward = index + 20 < sortedRows.length
      ? toNumber(sortedRows[index + 20].spx_close)
      : null;
    const twentyDayReturn = close !== null && previousClose !== null && previousClose !== 0
      ? close / previousClose - 1
      : null;

    return {
      ...row,
      markov_state: classifyMarkovState(twentyDayReturn, { bullThreshold, bearThreshold }),
      twenty_day_return: round(twentyDayReturn),
      forward_5d_return: close !== null && close5dForward !== null && close !== 0
        ? close5dForward / close - 1
        : null,
      forward_20d_return: close !== null && close20dForward !== null && close !== 0
        ? close20dForward / close - 1
        : null,
      fingerprint: buildHistoricalEdgeFingerprint(row),
    };
  });

  const counts = emptyTransitionCounts();
  const history = [];
  const result = new Map();
  let activeState = null;
  let activeDuration = 0;

  for (let index = 0; index < enrichedRows.length; index += 1) {
    const current = enrichedRows[index];

    if (current.markov_state !== activeState) {
      activeState = current.markov_state;
      activeDuration = current.markov_state ? 1 : 0;
    } else if (current.markov_state) {
      activeDuration += 1;
    }

    const markovProbabilities = getTransitionProbabilities(counts, current.markov_state);
    const forwardStats = getForwardReturnStats(history, current.fingerprint);
    const historicalDurations = getHistoricalDurations(history, current.markov_state);
    const stateDurationPercentile = percentileRank(historicalDurations, activeDuration);
    const edgeInput = {
      markov: {
        state: current.markov_state,
        ...(markovProbabilities ?? {}),
      },
      forwardStats,
      stateDurationPercentile,
    };
    const direction = classifyHistoricalEdgeDirection(edgeInput);
    const edgeScore = scoreHistoricalEdge(edgeInput);

    result.set(current.date, {
      historical_edge_fingerprint: current.fingerprint,
      historical_edge_direction: direction,
      historical_edge_score: edgeScore,
      markov_state: current.markov_state,
      markov_bull_probability: markovProbabilities?.bull_probability ?? null,
      markov_sideways_probability: markovProbabilities?.sideways_probability ?? null,
      markov_bear_probability: markovProbabilities?.bear_probability ?? null,
      markov_edge: markovProbabilities?.edge ?? null,
      markov_stickiness: markovProbabilities?.stickiness ?? null,
      markov_sample_size: markovProbabilities?.sample_size ?? 0,
      forward_5d_avg_return: forwardStats?.forward_5d_avg_return ?? null,
      forward_5d_win_rate: forwardStats?.forward_5d_win_rate ?? null,
      forward_20d_avg_return: forwardStats?.forward_20d_avg_return ?? null,
      forward_20d_win_rate: forwardStats?.forward_20d_win_rate ?? null,
      forward_sample_size: forwardStats?.forward_sample_size ?? 0,
      state_duration_days: activeDuration,
      state_duration_percentile: round(stateDurationPercentile),
      state_exhaustion_risk: stateDurationPercentile !== null && stateDurationPercentile >= 0.9,
    });

    const next = enrichedRows[index + 1];

    if (current.markov_state && next?.markov_state) {
      counts[current.markov_state][next.markov_state] += 1;
    }

    history.push(current);
  }

  return result;
}
