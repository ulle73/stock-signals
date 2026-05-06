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
      market_regime_score: row.market_regime_score,
      signal: row.signal,
      divergence_status: divergenceStatus,
      short_divergence_status: classifyShortDivergence({
        spx3dChange,
        pctAbove50_3dChange,
      }),
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
  const vixByDate = new Map(vixRows.map((row) => [row.date, toNumber(row.value)]));

  const alignedRows = breadthRows
    .filter((row) => row.is_valid_signal_date)
    .map((row) => ({
      date: row.date,
      spx_close: spxByDate.get(row.date) ?? null,
      pct_above_50: toNumber(row.pct_above_sma50),
      pct_above_200: toNumber(row.pct_above_sma200),
      advancers: Number(row.advancers),
      decliners: Number(row.decliners),
      new_highs: Number(row.new_highs_52w),
      new_lows: Number(row.new_lows_52w),
      vix: vixByDate.get(row.date) ?? null,
    }))
    .filter((row) => row.spx_close !== null && row.vix !== null);

  return buildMarketSignalRows(alignedRows, options);
}
