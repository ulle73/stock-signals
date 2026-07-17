import { GEX_DEX_LEVEL_DEFINITIONS } from './gex-dex-levels.js';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function validDate(value) {
  const date = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function historyObservation(snapshot, key, index) {
  const value = finiteNumber(snapshot?.[key]);
  if (value === null) return null;

  const rawTimestamp = String(snapshot?.sourceTimestamp ?? '').trim();
  const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : null;
  const sourceTimestamp = parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
    ? parsedTimestamp.toISOString()
    : null;
  const date = validDate(snapshot?.date) ?? sourceTimestamp?.slice(0, 10) ?? null;
  if (!date) return null;

  return {
    date,
    sourceTimestamp,
    value,
    sortKey: sourceTimestamp ?? `${date}T00:00:00.000Z`,
    index,
  };
}

function historyForLevel(snapshots, key, limit) {
  const ordered = snapshots
    .map((snapshot, index) => historyObservation(snapshot, key, index))
    .filter(Boolean)
    .sort((left, right) => (
      right.sortKey.localeCompare(left.sortKey)
      || right.index - left.index
    ));

  return ordered
    .map((item, index) => {
      const older = ordered[index + 1] ?? null;
      return {
        date: item.date,
        sourceTimestamp: item.sourceTimestamp,
        value: item.value,
        delta: older ? round(item.value - older.value) : null,
      };
    })
    .slice(0, limit);
}

function optionsState(snapshot) {
  if (!snapshot) return { label: 'Ingen GEX/DEX-data', tone: 'neutral' };
  if (snapshot.stale || snapshot.sourceStatus !== 'active') return { label: 'Stale data', tone: 'warning' };
  const netGex = finiteNumber(snapshot.netGex);
  if (netGex !== null && netGex > 0) return { label: 'Positiv gamma', tone: 'positive' };
  if (netGex !== null && netGex < 0) return { label: 'Negativ gamma', tone: 'danger' };
  return { label: snapshot.marketRegime || 'Neutral', tone: 'neutral' };
}

export function buildOptionsLadderHistory({ snapshots = [], limit = 10 } = {}) {
  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.max(1, Math.floor(Number(limit)))
    : 10;

  return Object.fromEntries(
    Object.keys(GEX_DEX_LEVEL_DEFINITIONS).map((key) => [
      key,
      historyForLevel(snapshots, key, normalizedLimit),
    ])
  );
}

export function buildOptionsLadderModel({ latestPrice = null, snapshot = null } = {}) {
  if (!snapshot) {
    return {
      state: optionsState(null),
      netGex: null,
      netDex: null,
      sourceTimestamp: null,
      rows: [],
    };
  }

  const spot = finiteNumber(latestPrice);
  const rows = Object.entries(GEX_DEX_LEVEL_DEFINITIONS)
    .flatMap(([key, definition]) => {
      const price = finiteNumber(snapshot[key]);
      if (price === null) return [];
      const distanceValue = spot === null ? null : round(price - spot);
      const distancePct = spot === null || spot === 0 ? null : round(((price - spot) / spot) * 100);
      return [{
        key,
        label: definition.label,
        color: definition.color,
        price,
        distanceValue,
        distancePct,
      }];
    })
    .sort((left, right) => right.price - left.price || left.label.localeCompare(right.label, 'en'));

  return {
    state: optionsState(snapshot),
    netGex: finiteNumber(snapshot.netGex),
    netDex: finiteNumber(snapshot.netDex),
    sourceTimestamp: snapshot.sourceTimestamp ?? null,
    rows,
  };
}
