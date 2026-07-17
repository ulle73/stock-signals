export const GEX_DEX_LEVEL_DEFINITIONS = Object.freeze({
  callWall: Object.freeze({ label: 'Call Wall', color: '#38bdf8', group: 'more' }),
  putWall: Object.freeze({ label: 'Put Wall', color: '#f472b6', group: 'more' }),
  gammaFlip: Object.freeze({ label: 'Gamma Flip', color: '#f59e0b', group: 'main', dashed: true }),
  dexResistance: Object.freeze({ label: 'DEX Resistance', color: '#a78bfa', group: 'more' }),
  dexSupport: Object.freeze({ label: 'DEX Support', color: '#22d3ee', group: 'more' }),
  volTrigger: Object.freeze({ label: 'Vol Trigger', color: '#fb923c', group: 'more', dashed: true }),
});

function validDate(value) {
  const date = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedSnapshots(snapshots, latestDate) {
  const byRenderedDate = new Map();
  const orderedBySourceDate = [...snapshots]
    .map((snapshot) => ({ ...snapshot, sourceDate: validDate(snapshot?.date) }))
    .filter((snapshot) => snapshot.sourceDate)
    .sort((left, right) => left.sourceDate.localeCompare(right.sourceDate));

  for (const snapshot of orderedBySourceDate) {
    const renderedDate = latestDate && snapshot.sourceDate > latestDate
      ? latestDate
      : snapshot.sourceDate;

    // Several intraday/current snapshots can map to the same latest candle.
    // The newest source observation must win without creating duplicate chart times.
    byRenderedDate.set(renderedDate, { ...snapshot, date: renderedDate });
  }

  return [...byRenderedDate.values()]
    .sort((left, right) => left.date.localeCompare(right.date));
}

function buildSingleLevel(snapshots, key, latestBarDate) {
  const latestDate = validDate(latestBarDate);
  const ordered = normalizedSnapshots(snapshots, latestDate);

  const data = [];
  let lastValue = null;
  for (const snapshot of ordered) {
    const value = finiteNumber(snapshot[key]);
    if (value === null) {
      if (data.length && data.at(-1)?.value !== undefined) data.push({ time: snapshot.date });
      lastValue = null;
      continue;
    }
    data.push({ time: snapshot.date, value });
    lastValue = value;
  }

  if (latestDate && lastValue !== null && data.at(-1)?.time !== latestDate) {
    data.push({ time: latestDate, value: lastValue });
  }
  return data;
}

export function buildGexDexLevelData(snapshots = [], latestBarDate = null) {
  return Object.fromEntries(
    Object.keys(GEX_DEX_LEVEL_DEFINITIONS).map((key) => [key, buildSingleLevel(snapshots, key, latestBarDate)])
  );
}

export function hasGexDexLevelGroup(snapshots = [], group = 'main') {
  const keys = Object.entries(GEX_DEX_LEVEL_DEFINITIONS)
    .filter(([, definition]) => definition.group === group)
    .map(([key]) => key);
  return snapshots.some((snapshot) => keys.some((key) => finiteNumber(snapshot?.[key]) !== null));
}
