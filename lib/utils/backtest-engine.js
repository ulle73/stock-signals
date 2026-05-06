import { calculateDailyStrategyReturn, calculateDrawdown } from './backtest-math.js';
import { formatIndicatorValueForStorage } from './rolling-indicators.js';

function normalize(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(formatIndicatorValueForStorage(value));
}

function parseParams(paramsJson) {
  if (!paramsJson) {
    return {};
  }

  if (typeof paramsJson === 'string') {
    return JSON.parse(paramsJson);
  }

  return paramsJson;
}

function evaluateStrategyState(strategy, signalRow) {
  const params = parseParams(strategy.params_json);
  const initialState = params.initial_state ?? 'cash';

  if (!signalRow) {
    return initialState;
  }

  switch (strategy.rule_source) {
    case 'always_long':
      return 'long';
    case 'bearish_divergence_risk_off':
      return ['bearish_warning', 'bearish_warning_strong'].includes(signalRow.divergence_status) ? 'cash' : 'long';
    case 'bullish_divergence_only':
      return signalRow.divergence_status === 'bullish_divergence' ? 'long' : 'cash';
    case 'pct_above_50_threshold':
      return Number(signalRow.pct_above_50) >= Number(params.threshold ?? 50) ? 'long' : 'cash';
    default:
      return initialState;
  }
}

function buildReasonCode(strategy, signalRow) {
  if (!signalRow) {
    return 'initial_state';
  }

  switch (strategy.rule_source) {
    case 'always_long':
      return 'always_long';
    case 'bearish_divergence_risk_off':
      return `divergence:${signalRow.divergence_status}`;
    case 'bullish_divergence_only':
      return `divergence:${signalRow.divergence_status}`;
    case 'pct_above_50_threshold':
      return `pct_above_50:${signalRow.pct_above_50}`;
    default:
      return strategy.rule_source;
  }
}

function calculateRatioMetric(numerator, denominator) {
  if (!denominator) {
    return null;
  }

  return normalize(numerator / denominator);
}

function calculateSharpeLike(dailyReturns, downsideOnly = false) {
  if (!dailyReturns.length) {
    return null;
  }

  const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
  const sample = downsideOnly ? dailyReturns.filter((value) => value < 0) : dailyReturns;

  if (!sample.length) {
    return null;
  }

  const variance = sample.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / sample.length;
  const deviation = Math.sqrt(variance);

  if (deviation === 0) {
    return null;
  }

  return normalize((mean / deviation) * Math.sqrt(252));
}

export function buildBacktestRunArtifacts({
  strategy,
  benchmarkBars,
  signalRows,
  initialEquity = 100,
}) {
  const sortedBars = [...benchmarkBars].sort((a, b) => a.date.localeCompare(b.date));
  const sortedSignals = [...signalRows].sort((a, b) => a.date.localeCompare(b.date));
  const transactionCostBps = Number(strategy.transaction_cost_bps);
  const positions = [];
  const equityRows = [];
  const dailyReturns = [];
  let previousState = 'cash';
  let previousBar = null;
  let signalIndex = -1;
  let strategyEquity = initialEquity;
  let benchmarkEquity = initialEquity;
  let runningPeak = initialEquity;
  let transitions = 0;
  let inMarketDays = 0;

  for (const currentBar of sortedBars) {
    while (signalIndex + 1 < sortedSignals.length && sortedSignals[signalIndex + 1].date < currentBar.date) {
      signalIndex += 1;
    }

    const signalRow = signalIndex >= 0 ? sortedSignals[signalIndex] : null;
    const nextState = evaluateStrategyState(strategy, signalRow);
    const dayResult = calculateDailyStrategyReturn({
      previousState,
      nextState,
      previousBar: previousBar ?? currentBar,
      currentBar,
      transactionCostBps,
    });
    const benchmarkResult = calculateDailyStrategyReturn({
      previousState: previousBar ? 'long' : 'cash',
      nextState: 'long',
      previousBar: previousBar ?? currentBar,
      currentBar,
      transactionCostBps: 0,
    });

    if (dayResult.tradeAction === 'enter' || dayResult.tradeAction === 'exit') {
      transitions += 1;
    }

    const startEquity = strategyEquity;
    strategyEquity = normalize(strategyEquity * (1 + (dayResult.strategyReturnPct / 100)));
    benchmarkEquity = normalize(benchmarkEquity * (1 + (benchmarkResult.strategyReturnPct / 100)));
    runningPeak = Math.max(runningPeak, strategyEquity);

    if (nextState === 'long') {
      inMarketDays += 1;
    }

    dailyReturns.push(dayResult.strategyReturnPct / 100);

    positions.push({
      date: currentBar.date,
      signal_date: signalRow?.date ?? null,
      effective_trade_date: dayResult.tradeAction === 'hold' || dayResult.tradeAction === 'stay_out'
        ? null
        : currentBar.date,
      target_state: nextState,
      applied_state: nextState,
      trade_action: dayResult.tradeAction,
      reason_code: buildReasonCode(strategy, signalRow),
    });

    equityRows.push({
      date: currentBar.date,
      start_equity: startEquity,
      end_equity: strategyEquity,
      strategy_return_pct: dayResult.strategyReturnPct,
      benchmark_return_pct: benchmarkResult.strategyReturnPct,
      cash_weight: nextState === 'cash' ? 1 : 0,
      equity_weight: nextState === 'long' ? 1 : 0,
      transaction_cost_pct: dayResult.transactionCostPct,
      transaction_cost_amount: normalize(startEquity * (dayResult.transactionCostPct / 100)),
      drawdown_pct: calculateDrawdown(strategyEquity, runningPeak),
      is_in_market: nextState === 'long',
    });

    previousState = nextState;
    previousBar = currentBar;
  }

  const firstDate = sortedBars[0]?.date;
  const lastDate = sortedBars.at(-1)?.date;
  const daySpan = sortedBars.length;
  const years = daySpan / 252;
  const endingEquity = equityRows.at(-1)?.end_equity ?? initialEquity;
  const maxDrawdown = equityRows.reduce(
    (min, row) => Math.min(min, row.drawdown_pct),
    0
  );

  return {
    positions,
    equityRows,
    summary: {
      signal_data_end_date: sortedSignals.at(-1)?.date ?? null,
      cagr: years > 0 ? normalize(((endingEquity / initialEquity) ** (1 / years) - 1) * 100) : null,
      max_drawdown: maxDrawdown,
      sharpe: calculateSharpeLike(dailyReturns),
      sortino: calculateSharpeLike(dailyReturns, true),
      calmar: maxDrawdown < 0 ? calculateRatioMetric(
        normalize(((endingEquity / initialEquity) ** (1 / years) - 1) * 100),
        Math.abs(maxDrawdown)
      ) : null,
      turnover: transitions,
      time_in_market_pct: normalize((inMarketDays / sortedBars.length) * 100),
      first_date: firstDate,
      last_date: lastDate,
      ending_equity: endingEquity,
      benchmark_ending_equity: benchmarkEquity,
    },
  };
}
