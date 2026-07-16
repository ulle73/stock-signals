function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 8) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values) {
  if (!values.length || values.some((value) => value === null)) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupSeries(rows) {
  const grouped = new Map();
  for (const row of rows ?? []) {
    const seriesId = String(row.series_id ?? row.seriesId ?? '').trim().toUpperCase();
    const date = String(row.date ?? '');
    const value = finiteNumber(row.value);
    if (!seriesId || !date || value === null) continue;
    const series = grouped.get(seriesId) ?? [];
    series.push({ date, value });
    grouped.set(seriesId, series);
  }
  for (const series of grouped.values()) series.sort((left, right) => left.date.localeCompare(right.date));
  return grouped;
}

export function alignYield2y10ySourceRows(rows = []) {
  const grouped = groupSeries(rows);
  const twoYear = new Map((grouped.get('DGS2') ?? []).map((row) => [row.date, row.value]));
  const tenYear = new Map((grouped.get('DGS10') ?? []).map((row) => [row.date, row.value]));
  const effrRows = grouped.get('FEDFUNDS') ?? [];
  const dates = [...twoYear.keys()].filter((date) => tenYear.has(date)).sort();

  let effrIndex = -1;
  let currentEffr = null;
  return dates.flatMap((date) => {
    while (effrIndex + 1 < effrRows.length && effrRows[effrIndex + 1].date <= date) {
      effrIndex += 1;
      currentEffr = effrRows[effrIndex].value;
    }
    if (currentEffr === null) return [];
    return [{ date, two_year: twoYear.get(date), ten_year: tenYear.get(date), effr: currentEffr }];
  });
}

export function buildYield2y10yIndicatorRows(sourceRows = []) {
  const aligned = alignYield2y10ySourceRows(sourceRows);
  const effrValues = [];
  let isLong = false;
  let isShort = false;
  let isInverted = false;

  return aligned.flatMap((row) => {
    const twoYear = finiteNumber(row.two_year);
    const tenYear = finiteNumber(row.ten_year);
    const effr = finiteNumber(row.effr);
    if (twoYear === null || tenYear === null || tenYear === 0 || effr === null) return [];

    effrValues.push(effr);
    const smoothEffr = effrValues.length >= 5 ? average(effrValues.slice(-5)) : null;
    const prevEffr = effrValues.length >= 2 ? effrValues.at(-2) : null;
    const prevSmoothEffr = effrValues.length >= 6 ? average(effrValues.slice(-6, -1)) : null;
    const frr = (5 * tenYear - twoYear) / (4 * tenYear);

    const buySignal = !isLong
      && frr > 1.10
      && smoothEffr !== null
      && prevEffr !== null
      && prevSmoothEffr !== null
      && smoothEffr < effr
      && prevSmoothEffr >= prevEffr;
    const sellSignal = !isShort && isInverted && frr > 1.005;
    const invertedSignal = !isInverted && frr < 1;

    if (buySignal) {
      isInverted = false;
      isLong = true;
      isShort = false;
    }
    if (sellSignal) {
      isInverted = false;
      isLong = false;
      isShort = true;
    }
    if (invertedSignal) {
      isInverted = true;
      isLong = false;
      isShort = false;
    }

    return [{
      date: row.date,
      two_year: round(twoYear),
      ten_year: round(tenYear),
      effr: round(effr),
      smooth_effr_5: smoothEffr === null ? null : round(smoothEffr),
      prev_effr: prevEffr === null ? null : round(prevEffr),
      prev_smooth_effr_5: prevSmoothEffr === null ? null : round(prevSmoothEffr),
      frr_2_10: round(frr),
      is_long: isLong,
      is_short: isShort,
      is_inverted: isInverted,
      buy_signal: buySignal,
      sell_signal: sellSignal,
      signal: buySignal ? 'buy' : sellSignal ? 'sell' : invertedSignal ? 'inverted' : 'none',
    }];
  });
}
