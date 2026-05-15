export const DEFAULT_TICKER = 'AAPL';

const MARKET_SERIES_META = [
  {
    seriesId: 'SP500',
    label: 'S&P 500',
    description: 'Index close',
  },
  {
    seriesId: 'VIXCLS',
    label: 'VIX',
    description: 'Volatility index',
  },
  {
    seriesId: 'BAMLH0A0HYM2',
    label: 'HY Spread',
    description: 'Credit stress',
  },
];

export function normalizeTickerInput(value, fallback = DEFAULT_TICKER) {
  const normalized = typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';

  return normalized || fallback;
}

export function resolveSelectedTicker(value, constituents, fallback = DEFAULT_TICKER) {
  const normalized = normalizeTickerInput(value, fallback);
  const activeTickers = new Set((constituents ?? []).map((item) => item.ticker));

  if (!activeTickers.size) {
    return normalized;
  }

  if (activeTickers.has(normalized)) {
    return normalized;
  }

  return constituents[0]?.ticker ?? fallback;
}

export function buildMarketSeriesCards(rows) {
  const rowBySeriesId = new Map(
    rows.map((row) => [row.series_id, row])
  );

  return MARKET_SERIES_META.map((meta) => {
    const row = rowBySeriesId.get(meta.seriesId);

    return {
      ...meta,
      value: row?.value ?? null,
      date: row?.date ?? null,
    };
  });
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 2) {
  if (value === null || value === undefined) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function positionTone(signal) {
  if (signal === 'risk_off') return 'danger';
  if (signal === 'risk_caution') return 'caution';
  if (signal === 'risk_on') return 'positive';
  return 'neutral';
}

function positionLabel(signal) {
  if (signal === 'risk_off') return 'Risk-off';
  if (signal === 'risk_caution') return 'Försiktigt läge';
  if (signal === 'risk_on') return 'Full risk-on';
  return 'Ingen positionssignal';
}

function persistenceDirectionLabel(direction) {
  if (direction === 'reduction') return 'Nedväxling väntar';
  if (direction === 'increase') return 'Uppväxling väntar';
  if (direction === 'hard_risk_off') return 'Snabb exit väntar';
  return 'Ingen väntande ändring';
}

function buildHardFlags(current) {
  return [
    {
      key: 'sp500_trend',
      label: 'S&P 500 under 200-dagars',
      active: current?.sp500_trend_regime === 'below_200dma',
      tone: 'danger',
      value: current?.sp500_trend_regime ?? null,
    },
    {
      key: 'vix_stress',
      label: 'VIX i stressläge',
      active: current?.vix_regime === 'stress',
      tone: 'danger',
      value: current?.vix_regime ?? null,
    },
    {
      key: 'credit_stress',
      label: 'Kreditspreadar i stress',
      active: current?.credit_regime === 'stress',
      tone: 'danger',
      value: current?.credit_regime ?? null,
    },
    {
      key: 'breadth_risk_off',
      label: 'Breadth-modellen är risk-off',
      active: current?.market_signal === 'risk_off',
      tone: 'warning',
      value: current?.market_signal ?? null,
    },
  ];
}

function buildCautionFlags(current) {
  return [
    {
      key: 'yield_curve',
      label: 'Yield curve är inverterad eller flat',
      active: ['flat', 'inverted'].includes(current?.yield_curve_regime),
      tone: 'caution',
      value: current?.yield_curve_regime ?? null,
    },
    {
      key: 'fed',
      label: 'Fed stramar åt',
      active: current?.fed_policy_trend === 'tightening',
      tone: 'caution',
      value: current?.fed_policy_trend ?? null,
    },
    {
      key: 'labor',
      label: 'Arbetsmarknaden försämras',
      active: current?.labor_trend === 'deteriorating',
      tone: 'warning',
      value: current?.labor_trend ?? null,
    },
    {
      key: 'inflation',
      label: 'Inflationen tar fart',
      active: current?.inflation_trend === 'heating_up',
      tone: 'warning',
      value: current?.inflation_trend ?? null,
    },
    {
      key: 'sentiment',
      label: 'Sentiment försämras',
      active: current?.sentiment_trend === 'deteriorating',
      tone: 'caution',
      value: current?.sentiment_trend ?? null,
    },
  ];
}

function buildBacktestSummary(backtests) {
  const position = backtests.find((row) => row.code === 'position_macro_signal_v1') ?? null;
  const benchmark = backtests.find((row) => row.code === 'buy_and_hold_spy') ?? null;

  const positionCagr = toNumber(position?.cagr);
  const benchmarkCagr = toNumber(benchmark?.cagr);
  const positionDrawdown = toNumber(position?.max_drawdown);
  const benchmarkDrawdown = toNumber(benchmark?.max_drawdown);

  return {
    position: position && {
      ...position,
      cagr: positionCagr,
      max_drawdown: positionDrawdown,
      time_in_market_pct: toNumber(position.time_in_market_pct),
    },
    benchmark: benchmark && {
      ...benchmark,
      cagr: benchmarkCagr,
      max_drawdown: benchmarkDrawdown,
      time_in_market_pct: toNumber(benchmark.time_in_market_pct),
    },
    deltaCagrPct: positionCagr !== null && benchmarkCagr !== null
      ? round(positionCagr - benchmarkCagr)
      : null,
    deltaDrawdownPct: positionDrawdown !== null && benchmarkDrawdown !== null
      ? round(Math.abs(benchmarkDrawdown) - Math.abs(positionDrawdown))
      : null,
  };
}

export function buildPositionStatusViewModel({
  current,
  previous,
  latestChange,
  backtests = [],
}) {
  if (!current) {
    return {
      current: null,
      flags: {
        hard: [],
        caution: [],
      },
      persistence: null,
      latestChange: null,
      backtest: buildBacktestSummary(backtests),
    };
  }

  const appliedEquityPct = toNumber(current.target_equity_weight_pct);
  const rawEquityPct = toNumber(current.raw_target_equity_weight_pct);
  const previousEquityPct = toNumber(previous?.target_equity_weight_pct);
  const hardFlags = buildHardFlags(current);
  const cautionFlags = buildCautionFlags(current);
  const persistenceRequiredDays = toNumber(current.persistence_required_days) ?? 0;
  const persistenceStreakDays = toNumber(current.persistence_streak_days) ?? 0;
  const persistenceDirection = current.persistence_direction ?? 'none';

  return {
    current: {
      date: current.date ?? null,
      signal: current.signal ?? null,
      signalLabel: positionLabel(current.signal),
      tone: positionTone(current.signal),
      decision: current.decision ?? null,
      rawDecision: current.raw_decision ?? null,
      appliedEquityPct,
      appliedCashPct: appliedEquityPct === null ? null : 100 - appliedEquityPct,
      rawEquityPct,
      rawCashPct: rawEquityPct === null ? null : 100 - rawEquityPct,
      isPending: appliedEquityPct !== null && rawEquityPct !== null && appliedEquityPct !== rawEquityPct,
      dayOverDayChangePct: appliedEquityPct !== null && previousEquityPct !== null
        ? round(appliedEquityPct - previousEquityPct)
        : null,
      hardRiskOffCount: toNumber(current.hard_risk_off_count) ?? 0,
      cautionCount: toNumber(current.caution_count) ?? 0,
      reasonSummary: current.reason_summary ?? null,
      marketSignal: current.market_signal ?? null,
      marketRegimeScore: toNumber(current.market_regime_score),
    },
    flags: {
      hard: hardFlags,
      hardActiveCount: hardFlags.filter((flag) => flag.active).length,
      caution: cautionFlags,
      cautionActiveCount: cautionFlags.filter((flag) => flag.active).length,
    },
    persistence: {
      direction: persistenceDirection,
      directionLabel: persistenceDirectionLabel(persistenceDirection),
      streakDays: persistenceStreakDays,
      requiredDays: persistenceRequiredDays,
      progressLabel: persistenceRequiredDays > 0
        ? `${persistenceStreakDays}/${persistenceRequiredDays} dagar bekräftade`
        : 'Ingen bekräftelse behövs',
    },
    latestChange: latestChange
      ? {
          date: latestChange.date ?? null,
          decision: latestChange.decision ?? null,
          previousEquityPct: toNumber(latestChange.previous_equity_weight_pct),
          newEquityPct: toNumber(latestChange.new_equity_weight_pct),
          direction:
            toNumber(latestChange.new_equity_weight_pct) < toNumber(latestChange.previous_equity_weight_pct)
              ? 'down'
              : toNumber(latestChange.new_equity_weight_pct) > toNumber(latestChange.previous_equity_weight_pct)
                ? 'up'
                : 'flat',
        }
      : null,
    backtest: buildBacktestSummary(backtests),
  };
}
