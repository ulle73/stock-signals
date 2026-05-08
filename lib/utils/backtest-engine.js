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

function stateFromWeight(weight) {
  return weight > 0 ? 'long' : 'cash';
}

function weightFromState(state) {
  return state === 'long' ? 1 : 0;
}

function evaluateStrategyWeight(strategy, signalRow) {
  const params = parseParams(strategy.params_json);
  const initialState = params.initial_state ?? 'cash';
  const initialWeight = normalize(params.initial_equity_weight ?? weightFromState(initialState)) ?? 0;

  if (!signalRow) {
    return initialWeight;
  }

  switch (strategy.rule_source) {
    case 'always_long':
      return 1;
    case 'market_regime_signal':
      return signalRow.signal === 'risk_on' ? 1 : 0;
    case 'bearish_divergence_risk_off':
      return ['bearish_warning', 'bearish_warning_strong'].includes(signalRow.divergence_status) ? 0 : 1;
    case 'bullish_divergence_only':
      return signalRow.divergence_status === 'bullish_divergence' ? 1 : 0;
    case 'pct_above_50_threshold':
      return Number(signalRow.pct_above_50) >= Number(params.threshold ?? 50) ? 1 : 0;
    case 'position_macro_signal':
      return normalize(Number(signalRow.target_equity_weight_pct) / 100) ?? 0;
    case 'trading_signal_long_cash':
      return signalRow.target_state === 'long' ? 1 : 0;
    default:
      return initialWeight;
  }
}

function buildReasonCode(strategy, signalRow) {
  if (!signalRow) {
    return 'initial_state';
  }

  switch (strategy.rule_source) {
    case 'always_long':
      return 'always_long';
    case 'market_regime_signal':
      return `signal:${signalRow.signal ?? 'unknown'} score:${signalRow.market_regime_score ?? 'na'}`;
    case 'bearish_divergence_risk_off':
      return `divergence:${signalRow.divergence_status}`;
    case 'bullish_divergence_only':
      return `divergence:${signalRow.divergence_status}`;
    case 'pct_above_50_threshold':
      return `pct_above_50:${signalRow.pct_above_50}`;
    case 'position_macro_signal':
      return `position_signal:${signalRow.signal ?? 'unknown'} target:${signalRow.target_equity_weight_pct ?? 'na'} decision:${signalRow.decision ?? 'na'}`;
    case 'trading_signal_long_cash':
      return `trading_signal:${signalRow.decision ?? 'unknown'} target:${signalRow.target_state ?? 'na'}`;
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
  positionSignalRows,
  tradingSignalRows,
  initialEquity = 100,
}) {
  const sortedBars = [...benchmarkBars].sort((a, b) => a.date.localeCompare(b.date));
  const selectedSignalRows = strategy.rule_source === 'position_macro_signal'
    ? (positionSignalRows ?? signalRows ?? [])
    : strategy.rule_source === 'trading_signal_long_cash'
      ? (tradingSignalRows ?? signalRows ?? [])
      : (signalRows ?? []);
  const sortedSignals = [...selectedSignalRows].sort((a, b) => a.date.localeCompare(b.date));
  const transactionCostBps = Number(strategy.transaction_cost_bps);
  const positions = [];
  const equityRows = [];
  const dailyReturns = [];
  const params = parseParams(strategy.params_json);
  let previousWeight = 0;
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
    const nextWeight = evaluateStrategyWeight(strategy, signalRow);
    const previousState = stateFromWeight(previousWeight);
    const nextState = stateFromWeight(nextWeight);
    const dayResult = calculateDailyStrategyReturn({
      previousState,
      nextState,
      previousWeight,
      nextWeight,
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

    if (['enter', 'exit', 'rebalance'].includes(dayResult.tradeAction)) {
      transitions += 1;
    }

    const startEquity = strategyEquity;
    strategyEquity = normalize(strategyEquity * (1 + (dayResult.strategyReturnPct / 100)));
    benchmarkEquity = normalize(benchmarkEquity * (1 + (benchmarkResult.strategyReturnPct / 100)));
    runningPeak = Math.max(runningPeak, strategyEquity);

    if (nextWeight > 0) {
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
      target_equity_weight: nextWeight,
      applied_equity_weight: nextWeight,
      trade_action: dayResult.tradeAction,
      reason_code: buildReasonCode(strategy, signalRow),
    });

    equityRows.push({
      date: currentBar.date,
      start_equity: startEquity,
      end_equity: strategyEquity,
      strategy_return_pct: dayResult.strategyReturnPct,
      benchmark_return_pct: benchmarkResult.strategyReturnPct,
      cash_weight: normalize(1 - nextWeight),
      equity_weight: nextWeight,
      transaction_cost_pct: dayResult.transactionCostPct,
      transaction_cost_amount: normalize(startEquity * (dayResult.transactionCostPct / 100)),
      drawdown_pct: calculateDrawdown(strategyEquity, runningPeak),
      is_in_market: nextWeight > 0,
    });

    previousWeight = nextWeight;
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
