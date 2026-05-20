import { buildHistoricalEdgeByDate } from './historical-edge.js';
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

function hasHistoricalBullEdge(historicalEdge) {
  return historicalEdge?.historical_edge_direction === 'bullish'
    && toNumber(historicalEdge.historical_edge_score) >= 0.25;
}

function hasHistoricalBearEdge(historicalEdge) {
  return historicalEdge?.historical_edge_direction === 'bearish'
    && toNumber(historicalEdge.historical_edge_score) <= -0.25;
}

function hasHistoricalRiskOffEdge(historicalEdge) {
  return historicalEdge?.historical_edge_direction === 'risk_off'
    || historicalEdge?.state_exhaustion_risk === true && toNumber(historicalEdge.markov_edge) < 0.1;
}

function classifySetup(row, historicalEdge = null) {
  const riskOff = evaluateRiskOffSetup(row);
  if (riskOff.qualified || hasHistoricalRiskOffEdge(historicalEdge)) {
    return {
      setup: 'risk_off',
      triggerCount: riskOff.triggerCount + (hasHistoricalRiskOffEdge(historicalEdge) ? 1 : 0),
      qualified: true,
      reasonSummary: riskOff.qualified ? riskOff.reasonSummary : 'historical_edge_risk_off',
    };
  }

  const bullish = evaluateBullishSetup(row);
  if (bullish.qualified || hasHistoricalBullEdge(historicalEdge)) {
    return {
      setup: 'bullish',
      triggerCount: bullish.triggerCount + (hasHistoricalBullEdge(historicalEdge) ? 1 : 0),
      qualified: true,
      reasonSummary: bullish.qualified ? bullish.reasonSummary : 'historical_edge_bullish',
    };
  }

  const bearish = evaluateBearishSetup(row);
  if (bearish.qualified || hasHistoricalBearEdge(historicalEdge)) {
    return {
      setup: 'bearish',
      triggerCount: bearish.triggerCount + (hasHistoricalBearEdge(historicalEdge) ? 1 : 0),
      qualified: true,
      reasonSummary: bearish.qualified ? bearish.reasonSummary : 'historical_edge_bearish',
    };
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

function buildReasonSummary(setup, historicalEdge) {
  const parts = [setup.reasonSummary];

  if (historicalEdge?.historical_edge_direction && historicalEdge.historical_edge_direction !== 'neutral') {
    parts.push(`historical_edge_${historicalEdge.historical_edge_direction}`);
  }

  if (historicalEdge?.markov_edge !== null && historicalEdge?.markov_edge !== undefined) {
    parts.push(`markov_edge_${historicalEdge.markov_edge}`);
  }

  return parts.join('|');
}

export function buildTradingSignalRowsFromSources({ marketSignalRows }) {
  const sortedRows = sortRows(marketSignalRows);
  const historicalEdgeByDate = buildHistoricalEdgeByDate(sortedRows);
  const tradingRows = [];
  let previousState = 'cash';

  for (const row of sortedRows) {
    const historicalEdge = historicalEdgeByDate.get(row.date) ?? {};
    const setup = classifySetup(row, historicalEdge);
    const action = applyDecision(previousState, setup);

    tradingRows.push({
      date: row.date,
      setup: setup.setup,
      decision: action.decision,
      previous_state: previousState,
      target_state: action.targetState,
      trigger_count: setup.triggerCount,
      market_regime_score: normalizeNumber(row.market_regime_score),
      reason_summary: buildReasonSummary(setup, historicalEdge),
      historical_edge_fingerprint: historicalEdge.historical_edge_fingerprint ?? null,
      historical_edge_direction: historicalEdge.historical_edge_direction ?? 'neutral',
      historical_edge_score: normalizeNumber(historicalEdge.historical_edge_score),
      markov_state: historicalEdge.markov_state ?? null,
      markov_bull_probability: normalizeNumber(historicalEdge.markov_bull_probability),
      markov_sideways_probability: normalizeNumber(historicalEdge.markov_sideways_probability),
      markov_bear_probability: normalizeNumber(historicalEdge.markov_bear_probability),
      markov_edge: normalizeNumber(historicalEdge.markov_edge),
      markov_stickiness: normalizeNumber(historicalEdge.markov_stickiness),
      markov_sample_size: historicalEdge.markov_sample_size ?? 0,
      forward_5d_avg_return: normalizeNumber(historicalEdge.forward_5d_avg_return),
      forward_5d_win_rate: normalizeNumber(historicalEdge.forward_5d_win_rate),
      forward_20d_avg_return: normalizeNumber(historicalEdge.forward_20d_avg_return),
      forward_20d_win_rate: normalizeNumber(historicalEdge.forward_20d_win_rate),
      forward_sample_size: historicalEdge.forward_sample_size ?? 0,
      state_duration_days: historicalEdge.state_duration_days ?? 0,
      state_duration_percentile: normalizeNumber(historicalEdge.state_duration_percentile),
      state_exhaustion_risk: historicalEdge.state_exhaustion_risk === true,
    });

    previousState = action.targetState;
  }

  return tradingRows;
}
