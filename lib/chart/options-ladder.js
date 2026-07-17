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

function optionsState(snapshot) {
  if (!snapshot) return { label: 'Ingen GEX/DEX-data', tone: 'neutral' };
  if (snapshot.stale || snapshot.sourceStatus !== 'active') return { label: 'Stale data', tone: 'warning' };
  const netGex = finiteNumber(snapshot.netGex);
  if (netGex !== null && netGex > 0) return { label: 'Positiv gamma', tone: 'positive' };
  if (netGex !== null && netGex < 0) return { label: 'Negativ gamma', tone: 'danger' };
  return { label: snapshot.marketRegime || 'Neutral', tone: 'neutral' };
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
