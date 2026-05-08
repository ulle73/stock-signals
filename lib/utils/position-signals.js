import { formatIndicatorValueForStorage } from './rolling-indicators.js';

const SOFT_REDUCTION_DAYS = 3;
const INCREASE_DAYS = 5;
const HARD_CLUSTER_3_THRESHOLD = 3;
const HARD_CLUSTER_3_DAYS = 3;
const HARD_CLUSTER_5_DAYS = 5;
const HARD_CLUSTER_4_THRESHOLD = 4;
const HARD_CLUSTER_4_DAYS = 2;

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNumber(value) {
  const number = toNumber(value);
  if (number === null) {
    return null;
  }

  return Number(formatIndicatorValueForStorage(number));
}

function sortRows(rows) {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

function createSignalLookup(rows) {
  return sortRows(rows).map((row) => ({
    date: row.date,
    market_regime_score: toNumber(row.market_regime_score),
    signal: row.signal ?? null,
  }));
}

function buildPrimaryCautionFlags(positionFactRow, marketSignalRow) {
  return [
    marketSignalRow?.signal ? marketSignalRow.signal !== 'risk_on' && marketSignalRow.signal !== 'risk_off' : true,
    positionFactRow.vix_regime === 'elevated',
    positionFactRow.credit_regime === 'elevated',
    positionFactRow.fed_policy_trend === 'tightening',
    positionFactRow.labor_trend === 'deteriorating',
    positionFactRow.sentiment_trend === 'deteriorating',
  ];
}

function buildSecondaryCautionFlags(positionFactRow) {
  return [
    positionFactRow.yield_curve_regime === 'flat' || positionFactRow.yield_curve_regime === 'inverted',
    positionFactRow.inflation_trend === 'heating_up',
  ];
}

function buildHardRiskOffFlags(positionFactRow, marketSignalRow) {
  return [
    positionFactRow.sp500_trend_regime === 'below_200dma',
    positionFactRow.vix_regime === 'stress',
    positionFactRow.credit_regime === 'stress',
    marketSignalRow?.signal === 'risk_off',
  ];
}

function countTrue(values) {
  return values.filter(Boolean).length;
}

function classifySoftTargetWeight(cautionCount) {
  if (cautionCount >= 6) {
    return 25;
  }

  if (cautionCount >= 4) {
    return 50;
  }

  if (cautionCount >= 1) {
    return 75;
  }

  return 100;
}

function buildDecision(targetWeightPct) {
  switch (targetWeightPct) {
    case 100:
      return 'FULLT INVESTERAD (100%)';
    case 75:
      return 'DELVIS INVESTERAD (75%)';
    case 50:
      return 'DELVIS INVESTERAD (50%)';
    case 25:
      return 'DELVIS INVESTERAD (25%)';
    default:
      return 'GÅ TILL CASH';
  }
}

function buildSignal(targetWeightPct) {
  if (targetWeightPct === 0) {
    return 'risk_off';
  }

  if (targetWeightPct === 100) {
    return 'risk_on';
  }

  return 'risk_caution';
}

function buildSoftReasonSummary(cautionCount) {
  if (cautionCount >= 3) {
    return 'multiple_caution_flags';
  }

  if (cautionCount > 0) {
    return 'moderate_caution';
  }

  return 'supportive_macro_and_breadth';
}

function countConsecutiveTargetDays(rows, endIndex, fieldName, targetWeightPct) {
  let streak = 0;

  for (let index = endIndex; index >= 0; index -= 1) {
    if (rows[index][fieldName] !== targetWeightPct) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function applyTargetPersistence(rows, {
  rawTargetField,
  reductionDays,
  increaseDays,
}) {
  const appliedTargets = [];

  for (let index = 0; index < rows.length; index += 1) {
    const currentRawTarget = rows[index][rawTargetField];
    const previousAppliedTarget = index > 0 ? appliedTargets[index - 1] : null;

    if (previousAppliedTarget === null || currentRawTarget === previousAppliedTarget) {
      appliedTargets.push(currentRawTarget);
      continue;
    }

    const isReduction = currentRawTarget < previousAppliedTarget;
    const requiredDays = isReduction ? reductionDays : increaseDays;
    const streakDays = countConsecutiveTargetDays(rows, index, rawTargetField, currentRawTarget);

    appliedTargets.push(
      streakDays >= requiredDays
        ? currentRawTarget
        : previousAppliedTarget
    );
  }

  return appliedTargets;
}

function buildRawPositionSignalRows(sortedPositionFacts, sortedMarketSignals) {
  const rows = [];
  let signalIndex = -1;

  for (const positionFactRow of sortedPositionFacts) {
    while (
      signalIndex + 1 < sortedMarketSignals.length &&
      sortedMarketSignals[signalIndex + 1].date <= positionFactRow.date
    ) {
      signalIndex += 1;
    }

    const marketSignalRow = signalIndex >= 0 ? sortedMarketSignals[signalIndex] : null;
    const hardRiskOffCount = countTrue(buildHardRiskOffFlags(positionFactRow, marketSignalRow));
    const primaryCautionCount = countTrue(buildPrimaryCautionFlags(positionFactRow, marketSignalRow));
    const secondaryCautionCount = primaryCautionCount > 0
      ? countTrue(buildSecondaryCautionFlags(positionFactRow))
      : 0;
    const cautionCount = primaryCautionCount + secondaryCautionCount;
    const softRawTargetEquityWeightPct = classifySoftTargetWeight(cautionCount);

    rows.push({
      date: positionFactRow.date,
      market_signal: marketSignalRow?.signal ?? null,
      market_regime_score: normalizeNumber(marketSignalRow?.market_regime_score ?? null),
      caution_count: cautionCount,
      hard_risk_off_count: hardRiskOffCount,
      soft_raw_target_equity_weight_pct: softRawTargetEquityWeightPct,
      soft_raw_reason_summary: buildSoftReasonSummary(cautionCount),
    });
  }

  return rows;
}

function applyHardRiskCaps(rows) {
  let hardRisk3PlusStreakDays = 0;
  let hardRisk4PlusStreakDays = 0;

  return rows.map((row) => {
    hardRisk3PlusStreakDays = row.hard_risk_off_count >= HARD_CLUSTER_3_THRESHOLD
      ? hardRisk3PlusStreakDays + 1
      : 0;
    hardRisk4PlusStreakDays = row.hard_risk_off_count >= HARD_CLUSTER_4_THRESHOLD
      ? hardRisk4PlusStreakDays + 1
      : 0;

    let hardRiskCapTargetEquityWeightPct = 100;
    let hardRiskCapReasonSummary = null;

    if (hardRisk4PlusStreakDays >= HARD_CLUSTER_4_DAYS) {
      hardRiskCapTargetEquityWeightPct = 0;
      hardRiskCapReasonSummary = 'hard_risk_cluster_cash';
    } else if (hardRisk3PlusStreakDays >= HARD_CLUSTER_5_DAYS) {
      hardRiskCapTargetEquityWeightPct = 25;
      hardRiskCapReasonSummary = 'hard_risk_cluster_5d';
    } else if (hardRisk3PlusStreakDays >= HARD_CLUSTER_3_DAYS) {
      hardRiskCapTargetEquityWeightPct = 50;
      hardRiskCapReasonSummary = 'hard_risk_cluster_3d';
    }

    return {
      ...row,
      hard_risk_3plus_streak_days: hardRisk3PlusStreakDays,
      hard_risk_4plus_streak_days: hardRisk4PlusStreakDays,
      hard_risk_cap_target_equity_weight_pct: hardRiskCapTargetEquityWeightPct,
      hard_risk_cap_reason_summary: hardRiskCapReasonSummary,
    };
  });
}

function buildFinalTargetRows(rows) {
  const rowsWithHardCaps = applyHardRiskCaps(rows);
  const softAppliedTargets = applyTargetPersistence(rowsWithHardCaps, {
    rawTargetField: 'soft_raw_target_equity_weight_pct',
    reductionDays: SOFT_REDUCTION_DAYS,
    increaseDays: INCREASE_DAYS,
  });
  const hardCapAppliedTargets = applyTargetPersistence(rowsWithHardCaps, {
    rawTargetField: 'hard_risk_cap_target_equity_weight_pct',
    reductionDays: 1,
    increaseDays: INCREASE_DAYS,
  });

  return rowsWithHardCaps.map((row, index) => {
    const rawTargetEquityWeightPct = Math.min(
      row.soft_raw_target_equity_weight_pct,
      row.hard_risk_cap_target_equity_weight_pct
    );
    const appliedTargetEquityWeightPct = Math.min(
      softAppliedTargets[index],
      hardCapAppliedTargets[index]
    );

    return {
      ...row,
      raw_target_equity_weight_pct: rawTargetEquityWeightPct,
      raw_target_cash_weight_pct: 100 - rawTargetEquityWeightPct,
      raw_signal: buildSignal(rawTargetEquityWeightPct),
      raw_decision: buildDecision(rawTargetEquityWeightPct),
      signal: buildSignal(appliedTargetEquityWeightPct),
      decision: buildDecision(appliedTargetEquityWeightPct),
      target_equity_weight_pct: appliedTargetEquityWeightPct,
      target_cash_weight_pct: 100 - appliedTargetEquityWeightPct,
      base_reason_summary: row.hard_risk_cap_reason_summary ?? row.soft_raw_reason_summary,
    };
  });
}

function finalizePositionSignalRows(rows) {
  return rows.map((row, index) => {
    if (row.raw_target_equity_weight_pct === row.target_equity_weight_pct) {
      return {
        date: row.date,
        signal: row.signal,
        decision: row.decision,
        target_equity_weight_pct: row.target_equity_weight_pct,
        target_cash_weight_pct: row.target_cash_weight_pct,
        raw_signal: row.raw_signal,
        raw_decision: row.raw_decision,
        raw_target_equity_weight_pct: row.raw_target_equity_weight_pct,
        raw_target_cash_weight_pct: row.raw_target_cash_weight_pct,
        market_signal: row.market_signal,
        market_regime_score: row.market_regime_score,
        caution_count: row.caution_count,
        hard_risk_off_count: row.hard_risk_off_count,
        reason_summary: row.base_reason_summary,
        persistence_direction: 'none',
        persistence_streak_days: 0,
        persistence_required_days: 0,
      };
    }

    const isReduction = row.raw_target_equity_weight_pct < row.target_equity_weight_pct;
    const persistenceDirection = isReduction ? 'reduction' : 'increase';
    const persistenceRequiredDays = isReduction ? SOFT_REDUCTION_DAYS : INCREASE_DAYS;
    const persistenceStreakDays = countConsecutiveTargetDays(
      rows,
      index,
      'raw_target_equity_weight_pct',
      row.raw_target_equity_weight_pct
    );

    return {
      date: row.date,
      signal: row.signal,
      decision: row.decision,
      target_equity_weight_pct: row.target_equity_weight_pct,
      target_cash_weight_pct: row.target_cash_weight_pct,
      raw_signal: row.raw_signal,
      raw_decision: row.raw_decision,
      raw_target_equity_weight_pct: row.raw_target_equity_weight_pct,
      raw_target_cash_weight_pct: row.raw_target_cash_weight_pct,
      market_signal: row.market_signal,
      market_regime_score: row.market_regime_score,
      caution_count: row.caution_count,
      hard_risk_off_count: row.hard_risk_off_count,
      reason_summary: isReduction
        ? 'persistence_hold_for_reduction'
        : 'persistence_hold_for_increase',
      persistence_direction: persistenceDirection,
      persistence_streak_days: persistenceStreakDays,
      persistence_required_days: persistenceRequiredDays,
    };
  });
}

export function buildPositionSignalRowsFromSources({
  positionFactRows,
  marketSignalRows,
}) {
  const sortedPositionFacts = sortRows(positionFactRows);
  const sortedMarketSignals = createSignalLookup(marketSignalRows);
  const rawRows = buildRawPositionSignalRows(sortedPositionFacts, sortedMarketSignals);
  const rowsWithTargets = buildFinalTargetRows(rawRows);

  return finalizePositionSignalRows(rowsWithTargets);
}
