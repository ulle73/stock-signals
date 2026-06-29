import { formatIndicatorValueForStorage } from './rolling-indicators.js';

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return Number(value);
}

function normalizeNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(formatIndicatorValueForStorage(value));
}

export function calculatePercentChange(currentValue, previousValue) {
  const current = toNumber(currentValue);
  const previous = toNumber(previousValue);

  if (current === null || previous === null || previous === 0) {
    return null;
  }

  return normalizeNumber(((current / previous) - 1) * 100);
}

export function calculatePointChange(currentValue, previousValue) {
  const current = toNumber(currentValue);
  const previous = toNumber(previousValue);

  if (current === null || previous === null) {
    return null;
  }

  return normalizeNumber(current - previous);
}

export function classifyLongDivergence({
  spx14dChange,
  pctAbove50_14dChange,
  adLine14dChange,
  newHighs,
  newHighs14dAgo,
  vix,
  vix14dAgo,
}) {
  if (spx14dChange !== null && pctAbove50_14dChange !== null && spx14dChange > 1 && pctAbove50_14dChange < -5) {
    if (
      (adLine14dChange !== null && adLine14dChange < 0) ||
      (newHighs !== null && newHighs14dAgo !== null && newHighs < newHighs14dAgo) ||
      (vix !== null && vix14dAgo !== null && vix > vix14dAgo)
    ) {
      return 'bearish_warning_strong';
    }

    return 'bearish_warning';
  }

  if (spx14dChange !== null && pctAbove50_14dChange !== null && spx14dChange < -1 && pctAbove50_14dChange > 5) {
    return 'bullish_divergence';
  }

  return 'none';
}

export function classifyShortDivergence({
  spx3dChange,
  pctAbove50_3dChange,
}) {
  if (spx3dChange !== null && pctAbove50_3dChange !== null && spx3dChange > 0 && pctAbove50_3dChange < 0) {
    return 'short_negative';
  }

  if (spx3dChange !== null && pctAbove50_3dChange !== null && spx3dChange < 0 && pctAbove50_3dChange > 0) {
    return 'short_positive';
  }

  return 'none';
}

function scoreBinaryThreshold(value, threshold = 50) {
  if (value === null) {
    return 0;
  }

  return value >= threshold ? 1 : -1;
}

function scoreDirectionalChange(value) {
  if (value === null) {
    return 0;
  }

  if (value > 0) {
    return 1;
  }

  if (value < 0) {
    return -1;
  }

  return 0;
}

function scoreHighLowSpread(newHighs, newLows) {
  if (newHighs === null || newLows === null) {
    return 0;
  }

  if (newHighs > newLows) {
    return 1;
  }

  if (newHighs < newLows) {
    return -1;
  }

  return 0;
}

function scoreVix(vix) {
  if (vix === null) {
    return 0;
  }

  if (vix <= 18) {
    return 1;
  }

  if (vix >= 25) {
    return -1;
  }

  return 0;
}

function scoreLongDivergence(divergenceStatus) {
  switch (divergenceStatus) {
    case 'bullish_divergence':
      return 1;
    case 'bearish_warning':
      return -1;
    case 'bearish_warning_strong':
      return -2;
    default:
      return 0;
  }
}

function scoreShortDivergence(shortDivergenceStatus) {
  switch (shortDivergenceStatus) {
    case 'short_positive':
      return 0.5;
    case 'short_negative':
      return -0.5;
    default:
      return 0;
  }
}

export function calculateMarketRegimeScore({
  pctAbove50,
  pctAbove200,
  spx14dChange,
  adLine14dChange,
  newHighs,
  newLows,
  vix,
  divergenceStatus,
  shortDivergenceStatus,
}) {
  return normalizeNumber(
    scoreBinaryThreshold(pctAbove50)
    + scoreBinaryThreshold(pctAbove200)
    + scoreDirectionalChange(spx14dChange)
    + scoreDirectionalChange(adLine14dChange)
    + scoreHighLowSpread(newHighs, newLows)
    + scoreVix(vix)
    + scoreLongDivergence(divergenceStatus)
    + scoreShortDivergence(shortDivergenceStatus)
  );
}

export function classifyMarketSignal(marketRegimeScore) {
  if (marketRegimeScore === null) {
    return 'neutral';
  }

  if (marketRegimeScore >= 3) {
    return 'risk_on';
  }

  if (marketRegimeScore <= -2) {
    return 'risk_off';
  }

  return 'neutral';
}

export function buildMarketSignalRows(rows, { shortWindow = 3, longWindow = 14 } = {}) {
  const normalizedRows = rows
    .map((row) => ({
      date: row.date,
      spx_close: toNumber(row.spx_close),
      pct_above_50: toNumber(row.pct_above_50),
      pct_above_200: toNumber(row.pct_above_200),
      advancers: Number(row.advancers),
      decliners: Number(row.decliners),
      new_highs: Number(row.new_highs),
      new_lows: Number(row.new_lows),
      vix: toNumber(row.vix),
      market_regime_score: row.market_regime_score ?? null,
      signal: row.signal ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const signalRows = [];
  let adLine = 0;

  for (let index = 0; index < normalizedRows.length; index += 1) {
    const row = normalizedRows[index];
    const shortLookback = index >= shortWindow ? signalRows[index - shortWindow] : null;
    const longLookback = index >= longWindow ? signalRows[index - longWindow] : null;

    adLine += row.advancers - row.decliners;

    const spx3dChange = calculatePercentChange(row.spx_close, shortLookback?.spx_close ?? null);
    const spx14dChange = calculatePercentChange(row.spx_close, longLookback?.spx_close ?? null);
    const pctAbove50_3dChange = calculatePointChange(row.pct_above_50, shortLookback?.pct_above_50 ?? null);
    const pctAbove50_14dChange = calculatePointChange(row.pct_above_50, longLookback?.pct_above_50 ?? null);
    const pctAbove200_14dChange = calculatePointChange(row.pct_above_200, longLookback?.pct_above_200 ?? null);
    const adLine14dChange = calculatePointChange(adLine, longLookback?.ad_line ?? null);

    const divergenceStatus = classifyLongDivergence({
      spx14dChange,
      pctAbove50_14dChange,
      adLine14dChange,
      newHighs: row.new_highs,
      newHighs14dAgo: longLookback?.new_highs ?? null,
      vix: row.vix,
      vix14dAgo: longLookback?.vix ?? null,
    });
    const shortDivergenceStatus = classifyShortDivergence({
      spx3dChange,
      pctAbove50_3dChange,
    });
    const marketRegimeScore = calculateMarketRegimeScore({
      pctAbove50: row.pct_above_50,
      pctAbove200: row.pct_above_200,
      spx14dChange,
      adLine14dChange,
      newHighs: row.new_highs,
      newLows: row.new_lows,
      vix: row.vix,
      divergenceStatus,
      shortDivergenceStatus,
    });

    signalRows.push({
      date: row.date,
      spx_close: row.spx_close,
      spx_3d_change: spx3dChange,
      spx_14d_change: spx14dChange,
      pct_above_50: row.pct_above_50,
      pct_above_50_3d_change: pctAbove50_3dChange,
      pct_above_50_14d_change: pctAbove50_14dChange,
      pct_above_200: row.pct_above_200,
      pct_above_200_14d_change: pctAbove200_14dChange,
      ad_line: adLine,
      ad_line_14d_change: adLine14dChange,
      new_highs: row.new_highs,
      new_lows: row.new_lows,
      vix: row.vix,
      market_regime_score: marketRegimeScore,
      signal: classifyMarketSignal(marketRegimeScore),
      divergence_status: divergenceStatus,
      short_divergence_status: shortDivergenceStatus,
    });
  }

  return signalRows;
}

export function buildMarketSignalRowsFromSources(
  {
    breadthRows,
    spxRows,
    vixRows,
  },
  options = {}
) {
  const spxByDate = new Map(spxRows.map((row) => [row.date, toNumber(row.value)]));
  const sortedVixRows = [...vixRows]
    .map((row) => ({ date: row.date, value: toNumber(row.value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let vixIndex = -1;
  let latestVix = null;

  const alignedRows = breadthRows
    .filter((row) => row.is_valid_signal_date)
    .map((row) => {
      while (
        vixIndex + 1 < sortedVixRows.length &&
        sortedVixRows[vixIndex + 1].date <= row.date
      ) {
        vixIndex += 1;
        latestVix = sortedVixRows[vixIndex].value;
      }

      return {
        date: row.date,
        spx_close: spxByDate.get(row.date) ?? null,
        pct_above_50: toNumber(row.pct_above_sma50),
        pct_above_200: toNumber(row.pct_above_sma200),
        advancers: Number(row.advancers),
        decliners: Number(row.decliners),
        new_highs: Number(row.new_highs_52w),
        new_lows: Number(row.new_lows_52w),
        vix: latestVix,
      };
    })
    .filter((row) => row.spx_close !== null && row.vix !== null);

  return buildMarketSignalRows(alignedRows, options);
}
