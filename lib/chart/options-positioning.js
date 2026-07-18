import { GEX_DEX_LEVEL_DEFINITIONS } from './gex-dex-levels.js';

const DEFAULT_MAX_PER_SIDE = 30;
const GEX_ANNOTATION_KEYS = Object.freeze(['callWall', 'putWall', 'gammaFlip', 'volTrigger']);
const DEX_ANNOTATION_KEYS = Object.freeze(['dexResistance', 'dexSupport', 'gammaFlip', 'volTrigger']);

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

function optionsState(snapshot) {
  if (!snapshot) return { label: 'Ingen GEX/DEX-data', tone: 'neutral' };
  if (snapshot.stale || snapshot.sourceStatus !== 'active') return { label: 'Stale data', tone: 'warning' };
  const netGex = finiteNumber(snapshot.netGex);
  if (netGex !== null && netGex > 0) return { label: 'Positiv gamma', tone: 'positive' };
  if (netGex !== null && netGex < 0) return { label: 'Negativ gamma', tone: 'danger' };
  return { label: snapshot.marketRegime || 'Neutral', tone: 'neutral' };
}

function normalizeStrike(row) {
  const strike = finiteNumber(row?.strike);
  if (strike === null) return null;
  return {
    strike,
    netGex: finiteNumber(row?.netGex ?? row?.net_gex),
    netDex: finiteNumber(row?.netDex ?? row?.net_dex),
    callGex: finiteNumber(row?.callGex ?? row?.call_gex),
    putGex: finiteNumber(row?.putGex ?? row?.put_gex),
    callDex: finiteNumber(row?.callDex ?? row?.call_dex),
    putDex: finiteNumber(row?.putDex ?? row?.put_dex),
    expiryCount: finiteNumber(row?.expiryCount ?? row?.expiry_count),
  };
}

function uniqueSortedStrikes(strikes = []) {
  const byStrike = new Map();
  for (const raw of strikes) {
    const row = normalizeStrike(raw);
    if (row) byStrike.set(row.strike, row);
  }
  return [...byStrike.values()].sort((left, right) => left.strike - right.strike);
}

function normalizedKeyLevels(keyLevels = {}) {
  return Object.fromEntries(
    Object.keys(GEX_DEX_LEVEL_DEFINITIONS).flatMap((key) => {
      const value = finiteNumber(keyLevels?.[key]);
      return value === null ? [] : [[key, value]];
    })
  );
}

function nearestStrike(rows, target) {
  if (!rows.length || !Number.isFinite(target)) return null;
  return rows.reduce((nearest, row) => {
    if (!nearest) return row;
    const currentDistance = Math.abs(row.strike - target);
    const nearestDistance = Math.abs(nearest.strike - target);
    return currentDistance < nearestDistance || (currentDistance === nearestDistance && row.strike < nearest.strike)
      ? row
      : nearest;
  }, null);
}

function selectSide(rows, spotPrice, maxPerSide, mandatoryStrikes) {
  if (rows.length <= maxPerSide) return rows;
  const mandatory = rows.filter((row) => mandatoryStrikes.has(row.strike));
  const nearest = [...rows].sort((left, right) => (
    Math.abs(left.strike - spotPrice) - Math.abs(right.strike - spotPrice)
    || left.strike - right.strike
  ));
  const selected = new Map(mandatory.map((row) => [row.strike, row]));
  for (const row of nearest) {
    if (selected.size >= maxPerSide) break;
    selected.set(row.strike, row);
  }
  return [...selected.values()].sort((left, right) => left.strike - right.strike);
}

export function selectOptionsPositioningStrikes({
  strikes = [],
  spotPrice,
  maxPerSide = DEFAULT_MAX_PER_SIDE,
  keyLevels = {},
} = {}) {
  const normalized = uniqueSortedStrikes(strikes);
  const spot = finiteNumber(spotPrice);
  const cap = Math.max(1, Math.floor(Number(maxPerSide) || DEFAULT_MAX_PER_SIDE));
  if (spot === null) {
    return normalized
      .slice(-cap * 2)
      .sort((left, right) => right.strike - left.strike);
  }

  const levels = normalizedKeyLevels(keyLevels);
  const mandatoryStrikes = new Set(
    Object.values(levels)
      .map((value) => nearestStrike(normalized, value)?.strike)
      .filter((value) => value !== null && value !== undefined)
  );
  const below = normalized.filter((row) => row.strike < spot);
  const atSpot = normalized.filter((row) => row.strike === spot);
  const above = normalized.filter((row) => row.strike > spot);

  return [
    ...selectSide(below, spot, cap, mandatoryStrikes),
    ...atSpot,
    ...selectSide(above, spot, cap, mandatoryStrikes),
  ].sort((left, right) => right.strike - left.strike);
}

function buildAnnotationMap(rows, snapshot, keys) {
  const map = new Map();
  for (const key of keys) {
    const value = finiteNumber(snapshot?.[key]);
    const definition = GEX_DEX_LEVEL_DEFINITIONS[key];
    if (value === null || !definition) continue;
    const row = nearestStrike(rows, value);
    if (!row) continue;
    const current = map.get(row.strike) ?? [];
    current.push({
      key,
      label: definition.label,
      color: definition.color,
      value,
      exact: Math.abs(row.strike - value) < 0.000001,
    });
    map.set(row.strike, current);
  }
  return map;
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
  return { date, sourceTimestamp, value, sortKey: sourceTimestamp ?? `${date}T00:00:00.000Z`, index };
}

function historyForLevel(snapshots, key, limit) {
  const ordered = snapshots
    .map((snapshot, index) => historyObservation(snapshot, key, index))
    .filter(Boolean)
    .sort((left, right) => right.sortKey.localeCompare(left.sortKey) || right.index - left.index);
  return ordered.map((item, index) => {
    const older = ordered[index + 1] ?? null;
    return {
      date: item.date,
      sourceTimestamp: item.sourceTimestamp,
      value: item.value,
      delta: older ? round(item.value - older.value) : null,
    };
  }).slice(0, limit);
}

export function buildOptionsPositioningLevelHistory({ snapshots = [], limit = 10 } = {}) {
  const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.floor(Number(limit))) : 10;
  return Object.fromEntries(
    Object.keys(GEX_DEX_LEVEL_DEFINITIONS).map((key) => [key, historyForLevel(snapshots, key, normalizedLimit)])
  );
}

export function buildOptionsPositioningModel({
  latestPrice = null,
  snapshots = [],
  strikes = [],
  maxPerSide = DEFAULT_MAX_PER_SIDE,
} = {}) {
  const snapshot = snapshots.at(-1) ?? null;
  const spotPrice = finiteNumber(snapshot?.spotPrice) ?? finiteNumber(latestPrice);
  const keyLevels = snapshot ? normalizedKeyLevels(snapshot) : {};
  const selected = selectOptionsPositioningStrikes({ strikes, spotPrice, maxPerSide, keyLevels });
  const maxGex = Math.max(1, ...selected.map((row) => Math.abs(row.netGex ?? 0)));
  const maxDex = Math.max(1, ...selected.map((row) => Math.abs(row.netDex ?? 0)));
  const rows = selected.map((row) => ({
    ...row,
    gexPct: round((Math.abs(row.netGex ?? 0) / maxGex) * 100),
    dexPct: round((Math.abs(row.netDex ?? 0) / maxDex) * 100),
    gexTone: row.netGex > 0 ? 'positive' : row.netGex < 0 ? 'negative' : 'neutral',
    dexTone: row.netDex > 0 ? 'positive' : row.netDex < 0 ? 'negative' : 'neutral',
  }));
  const spotStrike = nearestStrike(rows, spotPrice)?.strike ?? null;

  return {
    state: optionsState(snapshot),
    sourceTimestamp: snapshot?.sourceTimestamp ?? null,
    dataQuality: snapshot?.dataQuality ?? null,
    spotPrice,
    netGex: finiteNumber(snapshot?.netGex),
    netDex: finiteNumber(snapshot?.netDex),
    rows,
    spotStrike,
    gexAnnotations: buildAnnotationMap(rows, snapshot, GEX_ANNOTATION_KEYS),
    dexAnnotations: buildAnnotationMap(rows, snapshot, DEX_ANNOTATION_KEYS),
  };
}
