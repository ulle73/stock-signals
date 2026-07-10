const GAMMALENS_GEX_DEX_BASE_URL = 'https://gammalens-api.onrender.com/api/gex';
const DEFAULT_GAMMALENS_GEX_DEX_TICKERS = ['SPY', 'QQQ'];

function normalizeTicker(value) {
  const ticker = String(value ?? '').trim().toUpperCase();
  if (!ticker) {
    throw new Error('GammaLens ticker is required.');
  }

  return ticker;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requireFiniteNumber(value, label) {
  const number = toFiniteNumber(value);
  if (number === null) {
    throw new Error(`GammaLens payload is missing a valid ${label}.`);
  }

  return number;
}

function normalizeTimestamp(value) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('GammaLens payload is missing a valid timestamp.');
  }

  return timestamp.toISOString();
}

function normalizeStrikes(strikes) {
  if (!Array.isArray(strikes)) {
    throw new Error('GammaLens payload is missing strikes.');
  }

  const normalized = strikes
    .map((row) => {
      const strike = toFiniteNumber(row?.strike);
      if (strike === null) return null;

      return {
        strike,
        call_gex: toFiniteNumber(row.call_gex),
        put_gex: toFiniteNumber(row.put_gex),
        net_gex: toFiniteNumber(row.net_gex),
        call_dex: toFiniteNumber(row.call_dex),
        put_dex: toFiniteNumber(row.put_dex),
        net_dex: toFiniteNumber(row.net_dex),
        expiry_count: toFiniteNumber(row.expiry_count),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.strike - right.strike);

  if (!normalized.length) {
    throw new Error('GammaLens payload must include at least one valid strike.');
  }

  return normalized;
}

export function buildGammaLensGexDexUrl(ticker) {
  return `${GAMMALENS_GEX_DEX_BASE_URL}/${encodeURIComponent(normalizeTicker(ticker))}`;
}

export function resolveGammaLensGexDexTickers(value) {
  const tickers = String(value ?? '')
    .split(',')
    .map((ticker) => ticker.trim())
    .filter(Boolean)
    .map(normalizeTicker);

  return tickers.length ? [...new Set(tickers)] : [...DEFAULT_GAMMALENS_GEX_DEX_TICKERS];
}

export function parseGammaLensGexDexPayload(ticker, payload) {
  const expectedTicker = normalizeTicker(ticker);
  const payloadTicker = normalizeTicker(payload?.ticker);

  if (payloadTicker !== expectedTicker) {
    throw new Error(`GammaLens ticker mismatch: requested ${expectedTicker}, received ${payloadTicker}.`);
  }

  const keyLevels = payload?.key_levels;
  if (!keyLevels || typeof keyLevels !== 'object' || Array.isArray(keyLevels)) {
    throw new Error('GammaLens payload is missing key_levels.');
  }

  const sourceTimestamp = normalizeTimestamp(payload.timestamp);
  const sourceUrl = buildGammaLensGexDexUrl(expectedTicker);
  const stale = payload.stale === true;

  return {
    snapshot: {
      ticker: expectedTicker,
      source_timestamp: sourceTimestamp,
      source_url: sourceUrl,
      source_status: stale ? 'stale' : 'active',
      data_quality: typeof payload.data_quality === 'string' ? payload.data_quality : null,
      from_cache: payload.from_cache === true,
      stale,
      multi_expiry: payload.multi_expiry === true,
      spot_price: requireFiniteNumber(keyLevels.spot_price, 'key_levels.spot_price'),
      spot_change: toFiniteNumber(payload.spot_change),
      spot_change_pct: toFiniteNumber(payload.spot_changepct),
      call_wall: toFiniteNumber(keyLevels.call_wall),
      put_wall: toFiniteNumber(keyLevels.put_wall),
      gamma_flip: toFiniteNumber(keyLevels.gamma_flip),
      net_gex: toFiniteNumber(keyLevels.net_gex),
      net_dex: toFiniteNumber(keyLevels.net_dex),
      dealer_positioning: typeof keyLevels.dealer_positioning === 'string'
        ? keyLevels.dealer_positioning
        : null,
      market_regime: typeof keyLevels.market_regime === 'string'
        ? keyLevels.market_regime
        : null,
      dex_resistance: toFiniteNumber(keyLevels.dex_resistance),
      dex_support: toFiniteNumber(keyLevels.dex_support),
      atr_14: toFiniteNumber(keyLevels.atr_14),
      atr_pct: toFiniteNumber(keyLevels.atr_pct),
      key_levels: keyLevels,
      raw_payload: payload,
    },
    strikes: normalizeStrikes(payload.strikes),
  };
}

export async function fetchGammaLensGexDex(ticker, fetchFn = fetch) {
  const sourceUrl = buildGammaLensGexDexUrl(ticker);
  const response = await fetchFn(sourceUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'stock-signals-gex-dex-beta/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`GammaLens GEX/DEX fetch failed for ${normalizeTicker(ticker)}: ${response.status} ${response.statusText}`);
  }

  return parseGammaLensGexDexPayload(ticker, await response.json());
}
