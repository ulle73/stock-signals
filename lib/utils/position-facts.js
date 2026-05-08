import { formatIndicatorValueForStorage } from './rolling-indicators.js';

const DEFAULT_OPTIONS = {
  sp500SmaWindow: 200,
  macroTrendLookbackObservations: 3,
  cpiYoyLookbackObservations: 12,
  inflationTrendLookbackObservations: 3,
  vixElevatedThreshold: 20,
  vixStressThreshold: 30,
  creditElevatedThreshold: 4,
  creditStressThreshold: 6,
  yieldCurveFlatThreshold: 0.5,
  fedFundsTrendThreshold: 0.25,
  laborTrendThreshold: 0.2,
  inflationTrendThreshold: 0.25,
  sentimentTrendThreshold: 5,
};

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

function calculatePercentChange(currentValue, previousValue) {
  const current = toNumber(currentValue);
  const previous = toNumber(previousValue);

  if (current === null || previous === null || previous === 0) {
    return null;
  }

  return normalizeNumber(((current / previous) - 1) * 100);
}

function sortByDateAscending(rows) {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

function groupSeriesRows(marketSeriesRows) {
  const grouped = new Map();

  for (const row of marketSeriesRows) {
    const list = grouped.get(row.series_id) ?? [];
    list.push({
      date: row.date,
      value: toNumber(row.value),
    });
    grouped.set(row.series_id, list);
  }

  for (const [seriesId, rows] of grouped.entries()) {
    grouped.set(seriesId, sortByDateAscending(rows));
  }

  return grouped;
}

function attachObservationChange(rows, lookbackObservations, field = 'value', outputField = 'change') {
  return rows.map((row, index) => {
    const previousRow = index >= lookbackObservations ? rows[index - lookbackObservations] : null;
    const currentValue = toNumber(row[field]);
    const previousValue = previousRow ? toNumber(previousRow[field]) : null;

    return {
      ...row,
      [outputField]: currentValue === null || previousValue === null
        ? null
        : normalizeNumber(currentValue - previousValue),
    };
  });
}

function attachRollingAverage(rows, windowSize, field = 'value', outputField = 'moving_average') {
  const values = [];
  let sum = 0;

  return rows.map((row) => {
    const currentValue = toNumber(row[field]);

    if (currentValue === null) {
      values.push(null);
    } else {
      values.push(currentValue);
      sum += currentValue;
    }

    if (values.length > windowSize) {
      const removed = values.shift();
      if (removed !== null) {
        sum -= removed;
      }
    }

    const validValues = values.filter((value) => value !== null);
    const movingAverage = validValues.length === windowSize
      ? normalizeNumber(sum / windowSize)
      : null;

    return {
      ...row,
      [outputField]: movingAverage,
    };
  });
}

function attachCpiYoy(rows, lookbackObservations, outputField = 'cpi_yoy') {
  return rows.map((row, index) => {
    const previousRow = index >= lookbackObservations ? rows[index - lookbackObservations] : null;

    return {
      ...row,
      [outputField]: calculatePercentChange(row.value, previousRow?.value ?? null),
    };
  });
}

function createSeriesState(rowsBySeriesId) {
  return Object.fromEntries(
    Array.from(rowsBySeriesId.entries()).map(([seriesId, rows]) => [
      seriesId,
      {
        rows,
        index: -1,
        current: null,
      },
    ])
  );
}

function advanceSeriesState(state, marketDate) {
  while (state.index + 1 < state.rows.length && state.rows[state.index + 1].date <= marketDate) {
    state.index += 1;
    state.current = state.rows[state.index];
  }

  return state.current;
}

function classifySp500Trend(value, movingAverage) {
  if (value === null || movingAverage === null) {
    return 'no_data';
  }

  return value >= movingAverage ? 'above_200dma' : 'below_200dma';
}

function classifyVix(vix, options) {
  if (vix === null) {
    return 'no_data';
  }

  if (vix >= options.vixStressThreshold) {
    return 'stress';
  }

  if (vix >= options.vixElevatedThreshold) {
    return 'elevated';
  }

  return 'calm';
}

function classifyCredit(spread, options) {
  if (spread === null) {
    return 'no_data';
  }

  if (spread >= options.creditStressThreshold) {
    return 'stress';
  }

  if (spread >= options.creditElevatedThreshold) {
    return 'elevated';
  }

  return 'calm';
}

function classifyYieldCurve(spread, options) {
  if (spread === null) {
    return 'no_data';
  }

  if (spread < 0) {
    return 'inverted';
  }

  if (spread <= options.yieldCurveFlatThreshold) {
    return 'flat';
  }

  return 'normal';
}

function classifyFedPolicy(change, options) {
  if (change === null) {
    return 'no_data';
  }

  if (change <= -options.fedFundsTrendThreshold) {
    return 'easing';
  }

  if (change >= options.fedFundsTrendThreshold) {
    return 'tightening';
  }

  return 'stable';
}

function classifyLaborTrend(change, options) {
  if (change === null) {
    return 'no_data';
  }

  if (change >= options.laborTrendThreshold) {
    return 'deteriorating';
  }

  if (change <= -options.laborTrendThreshold) {
    return 'improving';
  }

  return 'stable';
}

function classifyInflationTrend(change, options) {
  if (change === null) {
    return 'no_data';
  }

  if (change >= options.inflationTrendThreshold) {
    return 'heating_up';
  }

  if (change <= -options.inflationTrendThreshold) {
    return 'cooling';
  }

  return 'stable';
}

function classifySentimentTrend(change, options) {
  if (change === null) {
    return 'no_data';
  }

  if (change >= options.sentimentTrendThreshold) {
    return 'improving';
  }

  if (change <= -options.sentimentTrendThreshold) {
    return 'deteriorating';
  }

  return 'stable';
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (typeof value === 'number') {
        return [key, normalizeNumber(value)];
      }

      return [key, value];
    })
  );
}

export function buildPositionFactRowsFromSources(
  {
    benchmarkRows,
    marketSeriesRows,
  },
  rawOptions = {}
) {
  const options = {
    ...DEFAULT_OPTIONS,
    ...rawOptions,
  };
  const marketDates = sortByDateAscending(benchmarkRows).map((row) => row.date);
  const rowsBySeriesId = groupSeriesRows(marketSeriesRows);

  rowsBySeriesId.set(
    'SP500',
    attachRollingAverage(rowsBySeriesId.get('SP500') ?? [], options.sp500SmaWindow).map((row) => ({
      ...row,
      pct_from_moving_average: calculatePercentChange(row.value, row.moving_average),
    }))
  );
  rowsBySeriesId.set(
    'FEDFUNDS',
    attachObservationChange(rowsBySeriesId.get('FEDFUNDS') ?? [], options.macroTrendLookbackObservations)
  );
  rowsBySeriesId.set(
    'UNRATE',
    attachObservationChange(rowsBySeriesId.get('UNRATE') ?? [], options.macroTrendLookbackObservations)
  );
  rowsBySeriesId.set(
    'UMCSENT',
    attachObservationChange(rowsBySeriesId.get('UMCSENT') ?? [], options.macroTrendLookbackObservations)
  );

  const cpiRowsWithYoy = attachCpiYoy(
    rowsBySeriesId.get('CPIAUCSL') ?? [],
    options.cpiYoyLookbackObservations
  );
  rowsBySeriesId.set(
    'CPIAUCSL',
    attachObservationChange(
      cpiRowsWithYoy,
      options.inflationTrendLookbackObservations,
      'cpi_yoy',
      'cpi_yoy_change'
    )
  );

  const seriesState = createSeriesState(rowsBySeriesId);
  const positionFactRows = [];

  for (const date of marketDates) {
    const sp500Row = seriesState.SP500 ? advanceSeriesState(seriesState.SP500, date) : null;
    const vixRow = seriesState.VIXCLS ? advanceSeriesState(seriesState.VIXCLS, date) : null;
    const highYieldRow = seriesState.BAMLH0A0HYM2 ? advanceSeriesState(seriesState.BAMLH0A0HYM2, date) : null;
    const yieldCurveRow = seriesState.T10Y2Y ? advanceSeriesState(seriesState.T10Y2Y, date) : null;
    const fedFundsRow = seriesState.FEDFUNDS ? advanceSeriesState(seriesState.FEDFUNDS, date) : null;
    const unemploymentRow = seriesState.UNRATE ? advanceSeriesState(seriesState.UNRATE, date) : null;
    const cpiRow = seriesState.CPIAUCSL ? advanceSeriesState(seriesState.CPIAUCSL, date) : null;
    const sentimentRow = seriesState.UMCSENT ? advanceSeriesState(seriesState.UMCSENT, date) : null;

    const rawRow = {
      date,
      sp500: sp500Row?.value ?? null,
      sp500_200dma: sp500Row?.moving_average ?? null,
      sp500_pct_from_200dma: sp500Row?.pct_from_moving_average ?? null,
      vix: vixRow?.value ?? null,
      high_yield_spread: highYieldRow?.value ?? null,
      yield_curve_spread: yieldCurveRow?.value ?? null,
      fed_funds: fedFundsRow?.value ?? null,
      fed_funds_change: fedFundsRow?.change ?? null,
      unemployment_rate: unemploymentRow?.value ?? null,
      unemployment_rate_change: unemploymentRow?.change ?? null,
      cpi_index: cpiRow?.value ?? null,
      cpi_yoy: cpiRow?.cpi_yoy ?? null,
      cpi_yoy_change: cpiRow?.cpi_yoy_change ?? null,
      consumer_sentiment: sentimentRow?.value ?? null,
      consumer_sentiment_change: sentimentRow?.change ?? null,
      sp500_observation_date: sp500Row?.date ?? null,
      vix_observation_date: vixRow?.date ?? null,
      high_yield_observation_date: highYieldRow?.date ?? null,
      yield_curve_observation_date: yieldCurveRow?.date ?? null,
      fed_funds_observation_date: fedFundsRow?.date ?? null,
      unemployment_observation_date: unemploymentRow?.date ?? null,
      cpi_observation_date: cpiRow?.date ?? null,
      consumer_sentiment_observation_date: sentimentRow?.date ?? null,
      sp500_trend_regime: classifySp500Trend(sp500Row?.value ?? null, sp500Row?.moving_average ?? null),
      vix_regime: classifyVix(vixRow?.value ?? null, options),
      credit_regime: classifyCredit(highYieldRow?.value ?? null, options),
      yield_curve_regime: classifyYieldCurve(yieldCurveRow?.value ?? null, options),
      fed_policy_trend: classifyFedPolicy(fedFundsRow?.change ?? null, options),
      labor_trend: classifyLaborTrend(unemploymentRow?.change ?? null, options),
      inflation_trend: classifyInflationTrend(cpiRow?.cpi_yoy_change ?? null, options),
      sentiment_trend: classifySentimentTrend(sentimentRow?.change ?? null, options),
      yield_curve_inverted: (yieldCurveRow?.value ?? null) !== null && yieldCurveRow.value < 0,
    };

    positionFactRows.push(normalizeRow(rawRow));
  }

  return positionFactRows;
}
