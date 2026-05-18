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

function getStateValue(bar, stateField) {
  return bar?.values?.[stateField] ?? null;
}

function isStateStart(index, bars, stateField, entryState) {
  if (index === 0) {
    return false;
  }

  const currentState = getStateValue(bars[index], stateField);
  const previousState = getStateValue(bars[index - 1], stateField);
  return currentState === entryState && previousState !== entryState;
}

function evaluateFiltersAtIndex(index, bars, config, registry) {
  if (!config.filters?.length) {
    return true;
  }

  const currentBar = bars[index];
  const previousBar = index > 0 ? bars[index - 1] : null;
  return evaluateConditionSet({
    conditions: config.filters,
    conditionMode: config.filterMode ?? 'ALL',
    currentBar,
    previousBar,
    registry,
  });
}

function resolveStatePeriodEnd(startIndex, bars, config) {
  let neutralStreak = 0;

  for (let index = startIndex + 1; index < bars.length; index += 1) {
    const state = getStateValue(bars[index], config.stateField);

    if (state === config.oppositeState) {
      return {
        endSignalIndex: index,
        endReason: 'opposite_state',
      };
    }

    if (config.neutralState && config.neutralEndDays > 0 && state === config.neutralState) {
      neutralStreak += 1;

      if (neutralStreak >= config.neutralEndDays) {
        return {
          endSignalIndex: index,
          endReason: `neutral_streak_${config.neutralEndDays}`,
        };
      }
    } else {
      neutralStreak = 0;
    }
  }

  return null;
}

function summarizePeriods(periods) {
  const returns = periods.map((period) => period.return_pct);
  const barsHeld = periods.map((period) => period.bars_held);

  return {
    period_count: periods.length,
    avg_return_pct: round(average(returns)),
    median_return_pct: round(median(returns)),
    win_rate_pct: round(periods.length ? (returns.filter((value) => value > 0).length / periods.length) * 100 : null),
    avg_bars_held: round(average(barsHeld)),
    median_bars_held: round(median(barsHeld)),
    best_return_pct: round(periods.length ? Math.max(...returns) : null),
    worst_return_pct: round(periods.length ? Math.min(...returns) : null),
  };
}

function resolveExit({ entryIndex, stateEnd, config }) {
  const exitDelayBars = config.exitDelayBars ?? 1;
  const stateExitIndex = stateEnd ? stateEnd.endSignalIndex + exitDelayBars : null;
  const maxHoldExitIndex = config.maxHoldBars && config.maxHoldBars > 0
    ? entryIndex + config.maxHoldBars
    : null;

  if (stateExitIndex !== null && maxHoldExitIndex !== null) {
    if (maxHoldExitIndex < stateExitIndex) {
      return {
        exitIndex: maxHoldExitIndex,
        endSignalIndex: maxHoldExitIndex,
        endReason: `max_hold_${config.maxHoldBars}`,
      };
    }

    return {
      exitIndex: stateExitIndex,
      endSignalIndex: stateEnd.endSignalIndex,
      endReason: stateEnd.endReason,
    };
  }

  if (stateExitIndex !== null) {
    return {
      exitIndex: stateExitIndex,
      endSignalIndex: stateEnd.endSignalIndex,
      endReason: stateEnd.endReason,
    };
  }

  if (maxHoldExitIndex !== null) {
    return {
      exitIndex: maxHoldExitIndex,
      endSignalIndex: maxHoldExitIndex,
      endReason: `max_hold_${config.maxHoldBars}`,
    };
  }

  return null;
}

export function runStatePeriodStudy(config, { bars, registry }) {
  const periods = [];
  const entryDelayBars = config.entryDelayBars ?? 1;
  const exitDelayBars = config.exitDelayBars ?? 1;
  const filtersApplyAt = config.filtersApplyAt ?? 'entry';

  for (let index = 0; index < bars.length; index += 1) {
    if (!isStateStart(index, bars, config.stateField, config.entryState)) {
      continue;
    }

    const entryIndex = index + entryDelayBars;
    if (!bars[entryIndex]) {
      continue;
    }

    const filterIndex = filtersApplyAt === 'signal_start' ? index : entryIndex;
    if (!evaluateFiltersAtIndex(filterIndex, bars, config, registry)) {
      continue;
    }

    const stateEnd = resolveStatePeriodEnd(index, bars, config);
    const exit = resolveExit({ entryIndex, stateEnd, config });
    if (!exit || !bars[exit.exitIndex] || exit.exitIndex <= entryIndex) {
      continue;
    }

    const entryBar = bars[entryIndex];
    const exitBar = bars[exit.exitIndex];
    const returnPct = calculateReturnPct(entryBar.price, exitBar.price);
    if (returnPct === null) {
      continue;
    }

    periods.push({
      signal_start_date: bars[index].date,
      entry_date: entryBar.date,
      end_signal_date: bars[exit.endSignalIndex]?.date ?? null,
      exit_date: exitBar.date,
      bars_held: exit.exitIndex - entryIndex,
      entry_price: round(entryBar.price),
      exit_price: round(exitBar.price),
      return_pct: round(returnPct),
      end_reason: exit.endReason,
    });
  }

  return {
    name: config.name,
    studyType: 'state_period',
    returnInstrument: config.returnInstrument,
    signalInstrument: config.signalInstrument ?? config.returnInstrument,
    stateField: config.stateField,
    entryState: config.entryState,
    oppositeState: config.oppositeState,
    neutralState: config.neutralState ?? null,
    neutralEndDays: config.neutralEndDays ?? 0,
    entryDelayBars,
    exitDelayBars,
    maxHoldBars: config.maxHoldBars ?? null,
    periods,
    summary: summarizePeriods(periods),
  };
}
