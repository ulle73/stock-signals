import { formatIndicatorValueForStorage } from './rolling-indicators.js';

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

function countTrue(values) {
  return values.filter(Boolean).length;
}

function evaluateBullishSetup(row) {
  const conditions = [
    toNumber(row.market_regime_score) >= 4,
    toNumber(row.pct_above_50) >= 55,
    toNumber(row.spx_3d_change) > 0,
    toNumber(row.spx_14d_change) > 0,
    Number(row.advancers) > Number(row.decliners),
    toNumber(row.ad_line_14d_change) > 0,
    toNumber(row.vix) < 20,
    row.divergence_status === 'none',
  ];

  return {
    setup: 'bullish',
    triggerCount: countTrue(conditions),
    qualified: conditions.every(Boolean),
    reasonSummary: 'strong_bull_confirmation',
  };
}

function evaluateBearishSetup(row) {
  const conditions = [
    toNumber(row.market_regime_score) <= -2,
    toNumber(row.pct_above_50) <= 45,
    toNumber(row.spx_3d_change) < 0,
    toNumber(row.spx_14d_change) < 0,
    Number(row.advancers) < Number(row.decliners),
    toNumber(row.ad_line_14d_change) < 0,
    toNumber(row.vix) >= 25,
    row.short_divergence_status === 'short_negative',
  ];

  return {
    setup: 'bearish',
    triggerCount: countTrue(conditions),
    qualified: countTrue(conditions) >= 7 && conditions[0] && conditions[1] && conditions[3] && conditions[4] && conditions[6],
    reasonSummary: 'strong_bear_confirmation',
  };
}

function evaluateRiskOffSetup(row) {
  const conditions = [
    toNumber(row.market_regime_score) <= -1,
    toNumber(row.pct_above_50) < 50,
    toNumber(row.spx_3d_change) < 0,
    Number(row.advancers) < Number(row.decliners),
    toNumber(row.vix) >= 30 || toNumber(row.pct_above_200) < 40,
  ];

  return {
    setup: 'risk_off',
    triggerCount: countTrue(conditions),
    qualified: conditions.every(Boolean),
    reasonSummary: 'extreme_risk_cash',
  };
}

function classifySetup(row) {
  const riskOff = evaluateRiskOffSetup(row);
  if (riskOff.qualified) {
    return riskOff;
  }

  const bullish = evaluateBullishSetup(row);
  if (bullish.qualified) {
    return bullish;
  }

  const bearish = evaluateBearishSetup(row);
  if (bearish.qualified) {
    return bearish;
  }

  return {
    setup: 'neutral',
    triggerCount: Math.max(riskOff.triggerCount, bullish.triggerCount, bearish.triggerCount),
    qualified: true,
    reasonSummary: 'mixed_signals',
  };
}

function applyDecision(previousState, setup) {
  if (setup.setup === 'bullish') {
    if (previousState === 'short') {
      return { decision: 'STÄNG KORT', targetState: 'cash' };
    }

    if (previousState === 'cash') {
      return { decision: 'KÖP SPY', targetState: 'long' };
    }

    return { decision: 'BEHÅLL', targetState: 'long' };
  }

  if (setup.setup === 'bearish') {
    if (previousState === 'long') {
      return { decision: 'SÄLJ SPY', targetState: 'cash' };
    }

    if (previousState === 'cash') {
      return { decision: 'GÅ KORT SPY', targetState: 'short' };
    }

    return { decision: 'BEHÅLL', targetState: 'short' };
  }

  if (setup.setup === 'risk_off') {
    if (previousState === 'long') {
      return { decision: 'GÅ TILL CASH', targetState: 'cash' };
    }

    if (previousState === 'short') {
      return { decision: 'STÄNG KORT', targetState: 'cash' };
    }

    return { decision: 'SITT STILL', targetState: 'cash' };
  }

  if (previousState === 'cash') {
    return { decision: 'SITT STILL', targetState: 'cash' };
  }

  return { decision: 'BEHÅLL', targetState: previousState };
}

export function buildTradingSignalRowsFromSources({ marketSignalRows }) {
  const sortedRows = sortRows(marketSignalRows);
  const tradingRows = [];
  let previousState = 'cash';

  for (const row of sortedRows) {
    const setup = classifySetup(row);
    const action = applyDecision(previousState, setup);

    tradingRows.push({
      date: row.date,
      setup: setup.setup,
      decision: action.decision,
      previous_state: previousState,
      target_state: action.targetState,
      trigger_count: setup.triggerCount,
      market_regime_score: normalizeNumber(row.market_regime_score),
      reason_summary: setup.reasonSummary,
    });

    previousState = action.targetState;
  }

  return tradingRows;
}
