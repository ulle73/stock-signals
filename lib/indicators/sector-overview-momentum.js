export const SECTOR_RETURN_WINDOWS = Object.freeze({
  oneDay: 1,
  oneWeek: 5,
  oneMonth: 21,
  sparkline: 21,
});

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 6) {
  if (value === null || value === undefined) return null;
  return Number(value.toFixed(digits));
}

function compound(points) {
  if (!points.length) return null;
  return points.reduce((level, point) => level * (1 + point / 100), 1);
}

function compoundedReturn(points, endIndex, sessions) {
  const startIndex = endIndex - sessions + 1;
  if (startIndex < 0) return null;

  const level = compound(points.slice(startIndex, endIndex + 1));
  return round((level - 1) * 100);
}

function latestBySector(rows, valueKey) {
  const values = new Map();

  for (const row of rows ?? []) {
    if (!row?.sector) continue;
    const value = toNumber(row[valueKey]);
    values.set(row.sector, value);
  }

  return values;
}

function latestSignalBySector(rows) {
  const values = new Map();

  for (const row of rows ?? []) {
    if (row?.sector) values.set(row.sector, row.signal ?? null);
  }

  return values;
}

function dailyReturnsBySector(dailyRows) {
  const grouped = new Map();

  for (const row of dailyRows ?? []) {
    if (!row?.sector || !row?.date) continue;
    const dailyReturn = toNumber(row.daily_return_pct);
    if (dailyReturn === null) continue;

    const byDate = grouped.get(row.sector) ?? new Map();
    const dailyValues = byDate.get(row.date) ?? [];
    dailyValues.push(dailyReturn);
    byDate.set(row.date, dailyValues);
    grouped.set(row.sector, byDate);
  }

  return grouped;
}

function buildSectorPoints(byDate) {
  return [...(byDate ?? new Map()).entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([, values]) => values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildSparkline(points) {
  let level = 1;

  return points.slice(-SECTOR_RETURN_WINDOWS.sparkline).map((point) => {
    level *= 1 + point / 100;
    return round((level - 1) * 100);
  });
}

function compareRows(left, right) {
  const leftStrength = left.strength ?? -Infinity;
  const rightStrength = right.strength ?? -Infinity;

  if (leftStrength !== rightStrength) return rightStrength - leftStrength;
  return left.sector.localeCompare(right.sector);
}

export function buildSectorOverviewRows({
  dailyRows = [],
  strengthRows = [],
  breadthRows = [],
  signalRows = [],
} = {}) {
  const bySector = dailyReturnsBySector(dailyRows);
  const strengthBySector = latestBySector(strengthRows, 'strength');
  const breadthBySector = latestBySector(breadthRows, 'pct_above_sma50');
  const signalBySector = latestSignalBySector(signalRows);
  const sectors = new Set([
    ...bySector.keys(),
    ...strengthBySector.keys(),
    ...breadthBySector.keys(),
    ...signalBySector.keys(),
  ]);

  return [...sectors]
    .map((sector) => {
      const points = buildSectorPoints(bySector.get(sector));
      const endIndex = points.length - 1;
      const roc5d = compoundedReturn(points, endIndex, SECTOR_RETURN_WINDOWS.oneWeek);
      const priorRoc5d = compoundedReturn(
        points,
        endIndex - SECTOR_RETURN_WINDOWS.oneWeek,
        SECTOR_RETURN_WINDOWS.oneWeek
      );

      return {
        sector,
        strength: strengthBySector.get(sector) ?? null,
        return1d: compoundedReturn(points, endIndex, SECTOR_RETURN_WINDOWS.oneDay),
        return1w: roc5d,
        return1m: compoundedReturn(points, endIndex, SECTOR_RETURN_WINDOWS.oneMonth),
        roc5d,
        acceleration5d: roc5d === null || priorRoc5d === null ? null : round(roc5d - priorRoc5d),
        sparkline: buildSparkline(points),
        breadth: breadthBySector.get(sector) ?? null,
        signal: signalBySector.get(sector) ?? null,
      };
    })
    .sort(compareRows);
}
