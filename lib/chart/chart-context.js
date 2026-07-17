function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dateValue(row) {
  return String(row?.date ?? row?.time ?? '').slice(0, 10);
}

function sortedRows(rows = []) {
  return [...rows]
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(dateValue(row)))
    .sort((left, right) => dateValue(left).localeCompare(dateValue(right)));
}

function directionFromDelta(delta, threshold = 0) {
  if (!Number.isFinite(delta)) return 'unknown';
  if (delta > threshold) return 'improving';
  if (delta < -threshold) return 'deteriorating';
  return 'stable';
}

export function buildRelativeStrengthContext(rows = []) {
  const ordered = sortedRows(rows).filter((row) => finiteNumber(row.rs_63d_vs_spy) !== null || finiteNumber(row.rs_percentile_63d) !== null);
  const latest = ordered.at(-1);
  if (!latest) return null;
  const comparison = ordered.at(-6) ?? null;
  const latest21 = finiteNumber(latest.rs_21d_vs_spy);
  const previous21 = finiteNumber(comparison?.rs_21d_vs_spy);
  const delta21 = latest21 !== null && previous21 !== null ? latest21 - previous21 : null;
  return {
    asOf: dateValue(latest),
    direction: directionFromDelta(delta21, 0.0001),
    delta21d: delta21 === null ? null : round(delta21, 6),
    value21d: latest21,
    percentile21d: finiteNumber(latest.rs_percentile_21d),
    value63d: finiteNumber(latest.rs_63d_vs_spy),
    percentile63d: finiteNumber(latest.rs_percentile_63d),
    value126d: finiteNumber(latest.rs_126d_vs_spy),
    percentile126d: finiteNumber(latest.rs_percentile_126d),
  };
}

function latestAndComparison(rows) {
  const ordered = sortedRows(rows).filter((row) => finiteNumber(row.pct_above_sma50) !== null);
  return { latest: ordered.at(-1) ?? null, comparison: ordered.at(-6) ?? null };
}

function breadthSnapshot(row) {
  if (!row) return null;
  return {
    asOf: dateValue(row),
    sma20: finiteNumber(row.pct_above_sma20),
    sma50: finiteNumber(row.pct_above_sma50),
    sma200: finiteNumber(row.pct_above_sma200),
    newHighs52w: finiteNumber(row.new_highs_52w),
    newLows52w: finiteNumber(row.new_lows_52w),
  };
}

export function buildBreadthContext({ sectorRows = [], marketRows = [] } = {}) {
  const sector = latestAndComparison(sectorRows);
  const market = latestAndComparison(marketRows);
  if (!sector.latest && !market.latest) return null;
  const latestSector50 = finiteNumber(sector.latest?.pct_above_sma50);
  const priorSector50 = finiteNumber(sector.comparison?.pct_above_sma50);
  const delta = latestSector50 !== null && priorSector50 !== null ? latestSector50 - priorSector50 : null;
  return {
    direction: directionFromDelta(delta, 2),
    delta5d: delta === null ? null : round(delta, 2),
    sector: breadthSnapshot(sector.latest),
    market: breadthSnapshot(market.latest),
  };
}

function normalizeOhlcRows(rows = []) {
  return sortedRows(rows).flatMap((row) => {
    const open = finiteNumber(row.open);
    const high = finiteNumber(row.high);
    const low = finiteNumber(row.low);
    const close = finiteNumber(row.close);
    const adjustedClose = finiteNumber(row.adj_close);
    if ([open, high, low, close].some((value) => value === null)) return [];
    const factor = close !== 0 && adjustedClose !== null && adjustedClose > 0 ? adjustedClose / close : 1;
    return [{
      date: dateValue(row),
      open: open * factor,
      high: high * factor,
      low: low * factor,
      close: adjustedClose ?? close,
    }];
  });
}

export function buildWilderAtrSeries(rows = [], period = 14) {
  const prices = normalizeOhlcRows(rows);
  if (prices.length < period) return [];
  const trueRanges = prices.map((row, index) => {
    if (index === 0) return row.high - row.low;
    const previousClose = prices[index - 1].close;
    return Math.max(row.high - row.low, Math.abs(row.high - previousClose), Math.abs(row.low - previousClose));
  });
  const result = [];
  let atr = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result.push({ date: prices[period - 1].date, atr, atrPct: prices[period - 1].close === 0 ? null : (atr / prices[period - 1].close) * 100, close: prices[period - 1].close });
  for (let index = period; index < prices.length; index += 1) {
    atr = ((atr * (period - 1)) + trueRanges[index]) / period;
    result.push({ date: prices[index].date, atr, atrPct: prices[index].close === 0 ? null : (atr / prices[index].close) * 100, close: prices[index].close });
  }
  return result;
}

function percentileRank(values, current) {
  if (!values.length || !Number.isFinite(current)) return null;
  const lessOrEqual = values.filter((value) => value <= current).length;
  return (lessOrEqual / values.length) * 100;
}

function realizedVolatility20(rows = []) {
  const prices = normalizeOhlcRows(rows);
  const returns = [];
  for (let index = 1; index < prices.length; index += 1) {
    if (prices[index - 1].close > 0 && prices[index].close > 0) returns.push(Math.log(prices[index].close / prices[index - 1].close));
  }
  const window = returns.slice(-20);
  if (window.length < 20) return null;
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
  const variance = window.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / window.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function buildVolatilityContext(rows = []) {
  const atrSeries = buildWilderAtrSeries(rows, 14).filter((row) => Number.isFinite(row.atrPct));
  const latest = atrSeries.at(-1);
  if (!latest) return null;
  const distribution = atrSeries.slice(-252).map((row) => row.atrPct);
  if (distribution.length < 20) return null;
  const percentile = percentileRank(distribution, latest.atrPct);
  const comparison = atrSeries.at(-6) ?? null;
  const delta = comparison ? latest.atrPct - comparison.atrPct : null;
  let regime = 'normal';
  if (percentile <= 25) regime = 'compression';
  else if (percentile >= 90) regime = 'extreme';
  else if (percentile >= 75) regime = 'expansion';
  return {
    asOf: latest.date,
    regime,
    direction: directionFromDelta(delta, 0.01),
    percentile: round(percentile, 0),
    atr14: round(latest.atr, 4),
    atrPct: round(latest.atrPct, 4),
    realizedVolatility20d: round(realizedVolatility20(rows), 2),
  };
}

function normalizeEarningsRows(rows = []) {
  const byDate = new Map();
  for (const row of rows) {
    const date = String(row?.earnings_date ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const candidate = {
      date,
      confirmed: row.confirmed === true || row.confirmed === 'true' || row.confirmed === 1,
      sourceStatus: String(row.source_status ?? 'missing'),
    };
    const existing = byDate.get(date);
    if (!existing || candidate.confirmed || existing.sourceStatus !== 'active') byDate.set(date, candidate);
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function calendarDaysBetween(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to - from) / 86400000);
}

export function buildEarningsContext(rows = [], barDates = [], latestDate = null) {
  const events = normalizeEarningsRows(rows);
  const availableDates = new Set(barDates.map((value) => String(value).slice(0, 10)));
  const chartEvents = events.filter((event) => availableDates.has(event.date));
  const next = latestDate ? events.find((event) => event.date > latestDate) ?? null : null;
  return {
    events: chartEvents,
    nextEarnings: next ? { ...next, daysUntil: calendarDaysBetween(latestDate, next.date) } : null,
  };
}

export function normalizeGexDexSnapshots(rows = []) {
  const byDate = new Map();
  for (const row of rows) {
    const timestamp = String(row?.source_timestamp ?? '');
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) continue;
    const date = parsed.toISOString().slice(0, 10);
    const keyLevels = row?.key_levels && typeof row.key_levels === 'object' && !Array.isArray(row.key_levels) ? row.key_levels : {};
    const snapshot = {
      date,
      sourceTimestamp: parsed.toISOString(),
      stale: row.stale === true || row.stale === 'true',
      sourceStatus: String(row.source_status ?? 'active'),
      dataQuality: row.data_quality ?? null,
      callWall: finiteNumber(row.call_wall),
      putWall: finiteNumber(row.put_wall),
      gammaFlip: finiteNumber(row.gamma_flip),
      netGex: finiteNumber(row.net_gex),
      netDex: finiteNumber(row.net_dex),
      dexResistance: finiteNumber(row.dex_resistance),
      dexSupport: finiteNumber(row.dex_support),
      volTrigger: finiteNumber(keyLevels.vol_trigger),
      dealerPositioning: row.dealer_positioning ?? null,
      marketRegime: row.market_regime ?? null,
    };
    const existing = byDate.get(date);
    if (!existing || snapshot.sourceTimestamp > existing.sourceTimestamp) byDate.set(date, snapshot);
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}
