function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

function avg(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values) {
  if (values.length < 2) return null;
  const mean = avg(values);
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function maxDrawdownFromDailyRows(rows) {
  if (!rows.length) return null;
  return rows.reduce((minDrawdown, row) => Math.min(minDrawdown, row.drawdown ?? 0), 0);
}

function sortByDate(rows) {
  return [...rows].sort((left, right) => left.date.localeCompare(right.date));
}

function buildPriceMaps(priceRows) {
  const byDate = new Map();
  const dates = [];

  for (const row of sortByDate(priceRows)) {
    const price = toNumber(row.open);
    if (!row.ticker || !row.date || price === null || price <= 0) continue;

    if (!byDate.has(row.date)) {
      byDate.set(row.date, new Map());
      dates.push(row.date);
    }

    byDate.get(row.date).set(row.ticker, price);
  }

  return { byDate, dates };
}

function buildMarketBenchmarkByDate(marketRows) {
  const byDate = new Map();

  for (const row of marketRows ?? []) {
    const price = toNumber(row.spx_close ?? row.close ?? row.value);
    if (!row.date || price === null || price <= 0) continue;
    byDate.set(row.date, price);
  }

  return byDate;
}

function buildMarkovByDate(markovRows) {
  const byDate = new Map();

  for (const row of markovRows) {
    if (!byDate.has(row.date)) {
      byDate.set(row.date, []);
    }

    byDate.get(row.date).push(row);
  }

  for (const rows of byDate.values()) {
    rows.sort((left, right) => {
      const totalDiff = Number(right.markov_total ?? -Infinity) - Number(left.markov_total ?? -Infinity);
      if (totalDiff !== 0) return totalDiff;
      return left.ticker.localeCompare(right.ticker);
    });
  }

  return byDate;
}

function buildTradingSignalByDate(tradingSignalRows) {
  const byDate = new Map();
  for (const row of tradingSignalRows ?? []) {
    byDate.set(row.date, row);
  }
  return byDate;
}

function isNewTradingWeek(previousTradingDate, executionDate) {
  if (!previousTradingDate) return true;
  const previous = new Date(`${previousTradingDate}T00:00:00Z`);
  const current = new Date(`${executionDate}T00:00:00Z`);
  return current.getUTCDay() < previous.getUTCDay();
}

function shouldRebalance(strategy, previousTradingDate, executionDate, hasRebalanced) {
  if (strategy.rebalanceFrequency === 'daily') return true;
  if (strategy.rebalanceFrequency === 'weekly') {
    return !hasRebalanced || isNewTradingWeek(previousTradingDate, executionDate);
  }

  return false;
}

function marketAllowsExposure(strategy, tradingSignalByDate, signalDate) {
  if (!strategy.marketFilter) return true;
  const row = tradingSignalByDate.get(signalDate);
  const direction = row?.historical_edge_direction;
  const setup = row?.setup;

  if (strategy.marketFilter === 'market_on') {
    return direction === 'bullish' || setup === 'bullish';
  }

  if (strategy.marketFilter === 'no_risk_off') {
    return !['risk_off', 'bearish'].includes(direction) && setup !== 'risk_off' && setup !== 'bearish';
  }

  return true;
}

function bottomBearExclusionSet(strategy, usableRows) {
  if (!strategy.excludeBottomBearCount) return new Set();

  return new Set(
    [...usableRows]
      .sort((left, right) => Number(left.markov_total) - Number(right.markov_total))
      .slice(0, strategy.excludeBottomBearCount)
      .map((row) => row.ticker)
  );
}

function pickTickers(strategy, markovRowsForDate) {
  const usableRows = markovRowsForDate.filter((row) =>
    row.markov_total !== null
    && row.markov_total !== undefined
    && Number(row.sample_size ?? 0) >= strategy.minSampleSize
  );

  if (strategy.side === 'short') {
    return [...usableRows]
      .sort((left, right) => Number(left.markov_total) - Number(right.markov_total))
      .slice(0, strategy.size)
      .map((row) => row.ticker);
  }

  const excludedTickers = bottomBearExclusionSet(strategy, usableRows);

  return [...usableRows]
    .filter((row) => !excludedTickers.has(row.ticker))
    .sort((left, right) => Number(right.markov_total) - Number(left.markov_total))
    .slice(0, strategy.size)
    .map((row) => row.ticker);
}

function symmetricDifferenceRatio(previousTickers, nextTickers) {
  const previousSet = new Set(previousTickers);
  const nextSet = new Set(nextTickers);
  let changed = 0;

  for (const ticker of previousSet) {
    if (!nextSet.has(ticker)) changed += 1;
  }

  for (const ticker of nextSet) {
    if (!previousSet.has(ticker)) changed += 1;
  }

  const denominator = Math.max(previousSet.size + nextSet.size, 1);
  return changed / denominator;
}

function basketReturn(tickers, executionPrices, nextExecutionPrices, side) {
  const returns = [];

  for (const ticker of tickers) {
    const executionPrice = executionPrices.get(ticker);
    const nextExecutionPrice = nextExecutionPrices.get(ticker);
    if (!executionPrice || !nextExecutionPrice) continue;

    const longReturn = nextExecutionPrice / executionPrice - 1;
    returns.push(side === 'short' ? -longReturn : longReturn);
  }

  return {
    returnValue: avg(returns) ?? 0,
    count: returns.length,
  };
}

function benchmarkEqualWeightReturn(executionPrices, nextExecutionPrices) {
  const returns = [];

  for (const [ticker, executionPrice] of executionPrices.entries()) {
    const nextExecutionPrice = nextExecutionPrices.get(ticker);
    if (!executionPrice || !nextExecutionPrice) continue;
    returns.push(nextExecutionPrice / executionPrice - 1);
  }

  return avg(returns) ?? 0;
}

function benchmarkSpyReturn(executionPrices, nextExecutionPrices, marketBenchmarkByDate, executionDate, nextExecutionDate) {
  const current = executionPrices.get('SPY') ?? executionPrices.get('SP500') ?? marketBenchmarkByDate.get(executionDate);
  const next = nextExecutionPrices.get('SPY') ?? nextExecutionPrices.get('SP500') ?? marketBenchmarkByDate.get(nextExecutionDate);
  if (!current || !next) return null;
  return next / current - 1;
}

function summarizeStrategy(strategy, dailyRows, spreadBps) {
  const returns = dailyRows.map((row) => row.portfolio_return).filter((value) => value !== null && value !== undefined);
  const wins = returns.filter((value) => value > 0).length;
  const totalReturn = dailyRows.at(-1)?.cumulative_return ?? null;
  const spyTotalReturn = dailyRows.at(-1)?.spy_cumulative_return ?? null;
  const equalWeightTotalReturn = dailyRows.at(-1)?.equal_weight_cumulative_return ?? null;

  return {
    strategy_name: strategy.name,
    rebalance_frequency: strategy.rebalanceFrequency,
    holding_days: strategy.holdingDays,
    side: strategy.side,
    spread_bps: spreadBps,
    start_date: dailyRows[0]?.date ?? null,
    end_date: dailyRows.at(-1)?.date ?? null,
    trading_days: dailyRows.length,
    total_return: round(totalReturn),
    spy_total_return: round(spyTotalReturn),
    equal_weight_total_return: round(equalWeightTotalReturn),
    excess_vs_spy: totalReturn !== null && spyTotalReturn !== null ? round(totalReturn - spyTotalReturn) : null,
    excess_vs_equal_weight: totalReturn !== null && equalWeightTotalReturn !== null ? round(totalReturn - equalWeightTotalReturn) : null,
    max_drawdown: round(maxDrawdownFromDailyRows(dailyRows)),
    win_rate: returns.length ? round(wins / returns.length) : null,
    avg_daily_return: round(avg(returns)),
    volatility_daily: round(stdDev(returns)),
    avg_ticker_count: round(avg(dailyRows.map((row) => row.ticker_count))),
  };
}

export const DEFAULT_TICKER_MARKOV_STRATEGIES = [
  { name: 'top_10_bull_daily', size: 10, side: 'long', rebalanceFrequency: 'daily', holdingDays: 1, minSampleSize: 50 },
  { name: 'top_20_bull_daily', size: 20, side: 'long', rebalanceFrequency: 'daily', holdingDays: 1, minSampleSize: 50 },
  { name: 'top_10_bull_weekly', size: 10, side: 'long', rebalanceFrequency: 'weekly', holdingDays: 5, minSampleSize: 50 },
  { name: 'top_20_bull_weekly', size: 20, side: 'long', rebalanceFrequency: 'weekly', holdingDays: 5, minSampleSize: 50 },
  { name: 'top_10_bull_weekly_market_on', size: 10, side: 'long', rebalanceFrequency: 'weekly', holdingDays: 5, minSampleSize: 50, marketFilter: 'market_on' },
  { name: 'top_20_bull_weekly_market_on', size: 20, side: 'long', rebalanceFrequency: 'weekly', holdingDays: 5, minSampleSize: 50, marketFilter: 'market_on' },
  { name: 'top_10_bull_weekly_no_risk_off', size: 10, side: 'long', rebalanceFrequency: 'weekly', holdingDays: 5, minSampleSize: 50, marketFilter: 'no_risk_off' },
  { name: 'top_20_bull_weekly_no_risk_off', size: 20, side: 'long', rebalanceFrequency: 'weekly', holdingDays: 5, minSampleSize: 50, marketFilter: 'no_risk_off' },
  { name: 'top_10_bull_weekly_exclude_bottom_20_bear', size: 10, side: 'long', rebalanceFrequency: 'weekly', holdingDays: 5, minSampleSize: 50, excludeBottomBearCount: 20 },
  { name: 'top_20_bull_weekly_exclude_bottom_20_bear', size: 20, side: 'long', rebalanceFrequency: 'weekly', holdingDays: 5, minSampleSize: 50, excludeBottomBearCount: 20 },
  { name: 'bottom_10_bear_weekly', size: 10, side: 'short', rebalanceFrequency: 'weekly', holdingDays: 5, minSampleSize: 50 },
  { name: 'bottom_20_bear_weekly', size: 20, side: 'short', rebalanceFrequency: 'weekly', holdingDays: 5, minSampleSize: 50 },
];

export function buildTickerMarkovStrategyStudy({
  priceRows,
  markovRows,
  tradingSignalRows = [],
  marketRows = [],
  strategies = DEFAULT_TICKER_MARKOV_STRATEGIES,
  spreadBps = 10,
} = {}) {
  const { byDate: openPricesByDate, dates } = buildPriceMaps(priceRows);
  const marketBenchmarkByDate = buildMarketBenchmarkByDate(marketRows);
  const markovByDate = buildMarkovByDate(markovRows);
  const tradingSignalByDate = buildTradingSignalByDate(tradingSignalRows);
  const dailyRows = [];
  const summaries = [];

  for (const strategy of strategies) {
    let activeTickers = [];
    let previousTradingDate = null;
    let hasRebalanced = false;
    let cumulative = 1;
    let spyCumulative = 1;
    let equalWeightCumulative = 1;
    let peak = 1;
    const strategyDailyRows = [];

    for (let index = 1; index < dates.length - 1; index += 1) {
      const signalDate = dates[index - 1];
      const executionDate = dates[index];
      const nextExecutionDate = dates[index + 1];
      const executionPrices = openPricesByDate.get(executionDate);
      const nextExecutionPrices = openPricesByDate.get(nextExecutionDate);
      const markovRowsForSignalDate = markovByDate.get(signalDate) ?? [];
      let spreadCost = 0;
      let rebalanceDate = null;

      if (shouldRebalance(strategy, previousTradingDate, executionDate, hasRebalanced)) {
        const nextTickers = marketAllowsExposure(strategy, tradingSignalByDate, signalDate)
          ? pickTickers(strategy, markovRowsForSignalDate)
          : [];
        const turnoverRatio = symmetricDifferenceRatio(activeTickers, nextTickers);
        spreadCost = turnoverRatio * (spreadBps / 10000);
        activeTickers = nextTickers;
        hasRebalanced = true;
        rebalanceDate = executionDate;
      }

      const basket = basketReturn(activeTickers, executionPrices, nextExecutionPrices, strategy.side);
      const grossReturn = activeTickers.length ? basket.returnValue : 0;
      const portfolioReturn = grossReturn - spreadCost;
      const spyReturn = benchmarkSpyReturn(executionPrices, nextExecutionPrices, marketBenchmarkByDate, executionDate, nextExecutionDate);
      const equalWeightReturn = benchmarkEqualWeightReturn(executionPrices, nextExecutionPrices);

      cumulative *= 1 + portfolioReturn;
      if (spyReturn !== null) spyCumulative *= 1 + spyReturn;
      equalWeightCumulative *= 1 + equalWeightReturn;
      peak = Math.max(peak, cumulative);

      const row = {
        strategy_name: strategy.name,
        date: nextExecutionDate,
        rebalance_date: rebalanceDate,
        rebalance_frequency: strategy.rebalanceFrequency,
        holding_days: strategy.holdingDays,
        side: activeTickers.length ? strategy.side : 'cash',
        ticker_count: activeTickers.length,
        tickers: activeTickers,
        gross_return: round(grossReturn),
        spread_cost: round(spreadCost),
        portfolio_return: round(portfolioReturn),
        cumulative_return: round(cumulative - 1),
        spy_return: round(spyReturn),
        spy_cumulative_return: spyReturn === null ? null : round(spyCumulative - 1),
        equal_weight_return: round(equalWeightReturn),
        equal_weight_cumulative_return: round(equalWeightCumulative - 1),
        excess_vs_spy: spyReturn === null ? null : round(portfolioReturn - spyReturn),
        excess_vs_equal_weight: round(portfolioReturn - equalWeightReturn),
        drawdown: round(cumulative / peak - 1),
      };

      strategyDailyRows.push(row);
      dailyRows.push(row);
      previousTradingDate = executionDate;
    }

    summaries.push(summarizeStrategy(strategy, strategyDailyRows, spreadBps));
  }

  return { dailyRows, summaries };
}
