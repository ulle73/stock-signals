const MAX_VISIBLE_STRIKES = 13;

const SIGNAL_META = {
  range: {
    label: 'Range',
    tone: 'positive',
    detail: 'Positiv gamma och spot mellan väggarna. Miljön kan gynna mindre rörelser.',
  },
  flip_risk: {
    label: 'Flip-risk',
    tone: 'caution',
    detail: 'Spot ligger nära gamma flip. Regim och nivåer kan ändras snabbt.',
  },
  expansion: {
    label: 'Expansion',
    tone: 'warning',
    detail: 'Negativ gamma med pris utanför en wall. Rörelser kan förstärkas.',
  },
  neutral: {
    label: 'Neutral',
    tone: 'neutral',
    detail: 'Ingen tydlig GEX/DEX-kontext enligt de tillgängliga nivåerna.',
  },
  unknown: {
    label: 'Ingen bedömning',
    tone: 'neutral',
    detail: 'Källdatan är ofullständig eller inaktuell.',
  },
};

function toNumber(value, digits = 4) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function percent(value, maximum) {
  if (value === null || maximum <= 0) return 0;
  return Math.round((Math.abs(value) / maximum) * 10000) / 100;
}

function sourceFreshness(row) {
  if (row.stale || row.source_status !== 'active') {
    return {
      label: 'Inaktuell källa',
      tone: 'warning',
      detail: 'Leverantören markerade denna snapshot som stale.',
    };
  }

  return {
    label: 'Aktiv',
    tone: 'positive',
    detail: row.from_cache ? 'Leverantörens cache är aktiv men snapshoten är inte stale.' : 'Direkt providersnapshot.',
  };
}

function buildLevels(row) {
  const levels = [
    { key: 'call_wall', label: 'Call wall', value: toNumber(row.call_wall), tone: 'warning' },
    { key: 'spot', label: 'Spot', value: toNumber(row.spot_price), tone: 'accent' },
    { key: 'put_wall', label: 'Put wall', value: toNumber(row.put_wall), tone: 'positive' },
    { key: 'gamma_flip', label: 'Gamma flip', value: toNumber(row.gamma_flip), tone: 'caution' },
  ].filter((level) => level.value !== null);

  return levels.sort((left, right) => right.value - left.value);
}

function buildStrikes(snapshotId, spotPrice, allStrikes) {
  const candidates = allStrikes
    .filter((row) => Number(row.snapshot_id) === Number(snapshotId))
    .map((row) => ({
      strike: toNumber(row.strike),
      netGex: toNumber(row.net_gex),
      netDex: toNumber(row.net_dex),
    }))
    .filter((row) => row.strike !== null)
    .sort((left, right) => Math.abs(left.strike - spotPrice) - Math.abs(right.strike - spotPrice))
    .slice(0, MAX_VISIBLE_STRIKES)
    .sort((left, right) => left.strike - right.strike);
  const maxGex = Math.max(1, ...candidates.map((row) => Math.abs(row.netGex ?? 0)));
  const maxDex = Math.max(1, ...candidates.map((row) => Math.abs(row.netDex ?? 0)));
  const nearestStrike = candidates.reduce((nearest, row) => {
    if (!nearest) return row;
    return Math.abs(row.strike - spotPrice) < Math.abs(nearest.strike - spotPrice) ? row : nearest;
  }, null)?.strike ?? null;

  return candidates.map((row) => ({
    ...row,
    gexBarPct: percent(row.netGex, maxGex),
    dexBarPct: percent(row.netDex, maxDex),
    gexTone: row.netGex > 0 ? 'positive' : row.netGex < 0 ? 'danger' : 'neutral',
    dexTone: row.netDex > 0 ? 'positive' : row.netDex < 0 ? 'danger' : 'neutral',
    isNearestSpotStrike: row.strike === nearestStrike,
  }));
}

function buildCard(row, allStrikes) {
  const spotPrice = toNumber(row.spot_price);
  const signal = SIGNAL_META[row.gex_dex_signal] ?? SIGNAL_META.unknown;

  return {
    id: row.id,
    ticker: row.ticker,
    sourceUrl: row.source_url,
    sourceTimestamp: row.source_timestamp,
    dataQuality: row.data_quality ?? 'okänd',
    multiExpiry: row.multi_expiry === true,
    freshness: sourceFreshness(row),
    signal: {
      key: row.gex_dex_signal ?? 'unknown',
      label: signal.label,
      tone: signal.tone,
      detail: signal.detail,
    },
    spotPrice,
    spotChangePct: toNumber(row.spot_change_pct),
    netGex: toNumber(row.net_gex),
    netDex: toNumber(row.net_dex),
    gammaRegime: row.gamma_regime ?? 'unknown',
    insideWalls: row.inside_walls === true,
    nearGammaFlip: row.near_gamma_flip === true,
    gexDexConfluence: row.gex_dex_confluence === true,
    atr14: toNumber(row.atr_14),
    spotToGammaFlipAtr: toNumber(row.spot_to_gamma_flip_atr),
    levels: buildLevels(row),
    strikes: buildStrikes(row.id, spotPrice ?? 0, allStrikes),
  };
}

export function buildGexDexDashboardView(rows, strikes) {
  return {
    cards: rows.map((row) => buildCard(row, strikes)),
  };
}
