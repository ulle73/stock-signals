import { evaluateConditionSet } from './dynamic-condition-engine.js';

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function calculateReturnPct(entryPrice, exitPrice) {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice) || entryPrice === 0) {
    return null;
  }

  return ((exitPrice / entryPrice) - 1) * 100;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middleIndex];
  }

  return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
}

function summarizeHorizon(horizonDays, samples) {
  return {
    horizon_days: horizonDays,
    sample_count: samples.length,
    avg_return_pct: round(average(samples)),
    median_return_pct: round(median(samples)),
    win_rate_pct: round(samples.length ? (samples.filter((value) => value > 0).length / samples.length) * 100 : null),
    best_return_pct: round(samples.length ? Math.max(...samples) : null),
    worst_return_pct: round(samples.length ? Math.min(...samples) : null),
  };
}

function pickBestHorizon(horizons, fieldName, higherIsBetter = true) {
  const candidates = horizons.filter((row) => row.sample_count > 0 && row[fieldName] !== null && row[fieldName] !== undefined);
  if (!candidates.length) {
    return null;
  }

  return candidates.reduce((best, row) => {
    if (!best) return row;
    return higherIsBetter
      ? row[fieldName] > best[fieldName] ? row : best
      : row[fieldName] < best[fieldName] ? row : best;
  }, null);
}

function buildBestHorizonSummary(horizons) {
  const bestAvg = pickBestHorizon(horizons, 'avg_return_pct');
  const bestMedian = pickBestHorizon(horizons, 'median_return_pct');
  const bestWinRate = pickBestHorizon(horizons, 'win_rate_pct');
  const worstAvg = pickBestHorizon(horizons, 'avg_return_pct', false);

  return {
    best_avg_return_horizon_days: bestAvg?.horizon_days ?? null,
    best_avg_return_pct: bestAvg?.avg_return_pct ?? null,
    best_median_return_horizon_days: bestMedian?.horizon_days ?? null,
    best_median_return_pct: bestMedian?.median_return_pct ?? null,
    best_win_rate_horizon_days: bestWinRate?.horizon_days ?? null,
    best_win_rate_pct: bestWinRate?.win_rate_pct ?? null,
    worst_avg_return_horizon_days: worstAvg?.horizon_days ?? null,
    worst_avg_return_pct: worstAvg?.avg_return_pct ?? null,
  };
}

function isForwardEvent({ index, bars, config, registry }) {
  const currentBar = bars[index];
  const previousBar = index > 0 ? bars[index - 1] : null;
  const currentMatch = evaluateConditionSet({
    conditions: config.conditions,
    conditionMode: config.conditionMode ?? 'ALL',
    currentBar,
    previousBar,
    registry,
  });

  if (!currentMatch) {
    return false;
  }

  if ((config.eventMode ?? 'signal_start') === 'every_match') {
    return true;
  }

  if (!previousBar) {
    return false;
  }

  const previousMatch = evaluateConditionSet({
    conditions: config.conditions,
    conditionMode: config.conditionMode ?? 'ALL',
    currentBar: previousBar,
    previousBar: index > 1 ? bars[index - 2] : null,
    registry,
  });

  return !previousMatch;
}

function shouldSkipForSpacing(index, lastAcceptedSignalIndex, minBarsBetweenEvents) {
  if (lastAcceptedSignalIndex === null || minBarsBetweenEvents <= 0) {
    return false;
  }

  return index - lastAcceptedSignalIndex < minBarsBetweenEvents;
}

export function runForwardReturnStudy(config, { bars, registry }) {
  const events = [];
  const horizonSamples = new Map();
  const entryDelayBars = config.entryDelayBars ?? 1;
  const minBarsBetweenEvents = config.allowOverlappingEvents === false
    ? config.maxHorizonDays + entryDelayBars
    : config.minBarsBetweenEvents ?? 0;
  let lastAcceptedSignalIndex = null;

  for (let horizon = 1; horizon <= config.maxHorizonDays; horizon += 1) {
    horizonSamples.set(horizon, []);
  }

  for (let index = 0; index < bars.length; index += 1) {
    if (!isForwardEvent({ index, bars, config, registry })) {
      continue;
    }

    if (shouldSkipForSpacing(index, lastAcceptedSignalIndex, minBarsBetweenEvents)) {
      continue;
    }

    const signalBar = bars[index];
    const entryIndex = index + entryDelayBars;
    const entryBar = bars[entryIndex];

    if (!entryBar) {
      continue;
    }

    lastAcceptedSignalIndex = index;
    events.push({
      signal_date: signalBar.date,
      signal_price: round(signalBar.price),
      entry_date: entryBar.date,
      entry_price: round(entryBar.price),
    });

    for (let horizon = 1; horizon <= config.maxHorizonDays; horizon += 1) {
      const futureBar = bars[entryIndex + horizon];
      if (!futureBar) {
        continue;
      }

      const returnPct = calculateReturnPct(entryBar.price, futureBar.price);
      if (returnPct === null) {
        continue;
      }

      horizonSamples.get(horizon).push(returnPct);
    }
  }

  const horizons = Array.from(horizonSamples.entries()).map(([horizonDays, samples]) =>
    summarizeHorizon(horizonDays, samples)
  );

  return {
    name: config.name,
    studyType: 'forward_horizon',
    returnInstrument: config.returnInstrument,
    signalInstrument: config.signalInstrument ?? config.returnInstrument,
    conditionMode: config.conditionMode ?? 'ALL',
    eventMode: config.eventMode ?? 'signal_start',
    entryDelayBars,
    minBarsBetweenEvents,
    allowOverlappingEvents: config.allowOverlappingEvents ?? true,
    eventCount: events.length,
    events,
    summary: buildBestHorizonSummary(horizons),
    horizons,
  };
}
