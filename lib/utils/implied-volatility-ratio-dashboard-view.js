const DOMAIN_MIN = -4;
const DOMAIN_MAX = 10;
const TICKS = [-4, -2, 0, 2, 4, 6, 8, 10];

const DISPLAY_NAME_BY_ASSET_KEY = {
  qqq_nasdaq: 'PowerShares QQQ',
  spy_sp500: 'SPDR S&P 500 SPY',
  dia_dow: 'SPDR Dow Jones Industr.',
  gld_gold: 'SPDR Gold Trust',
  uso_oil: 'United States Oil',
  ewz_brazil: 'iShares MSCI Brazil',
  efa_developed: 'iShares MSCI EAFE',
  iwm_russell2000: 'iShares Russell 2000',
  xle_energy: 'SPDR Energy Select',
  smh_semiconductors: 'VanEck Semiconductors',
  arkk_innovation: 'ARK Innovation',
  gdx_gold_miners: 'VanEck Gold Miners',
  fxe_euro: 'CurrencyShares Euro',
  uup_us_dollar: 'Invesco DB US Dollar',
  xlk_technology: 'SPDR Technology',
  xlf_financials: 'SPDR Financials',
  xlv_healthcare: 'SPDR Healthcare',
};

function toNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function positionPct(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return toNumber(((clamp(value, DOMAIN_MIN, DOMAIN_MAX) - DOMAIN_MIN) / (DOMAIN_MAX - DOMAIN_MIN)) * 100);
}

function compactDisplayName(row) {
  return DISPLAY_NAME_BY_ASSET_KEY[row.asset_key] ?? row.asset_name ?? row.source_symbol ?? row.asset_key;
}

function rowView(row) {
  const currentZScore = toNumber(row.ivol_rvol_ratio_z_1y);
  const oneWeekAgoZScore = toNumber(row.ivol_rvol_ratio_z_1w_ago);
  const rangeMin = toNumber(row.ivol_rvol_ratio_z_1y_min);
  const rangeMax = toNumber(row.ivol_rvol_ratio_z_1y_max);
  const displayName = compactDisplayName(row);

  return {
    assetKey: row.asset_key,
    assetName: row.asset_name,
    displayName,
    displayLabel: `${displayName}: ${currentZScore?.toFixed(1) ?? '—'}`,
    currentZScore,
    oneWeekAgoZScore,
    rangeMin,
    rangeMax,
    currentPositionPct: positionPct(currentZScore),
    oneWeekAgoPositionPct: positionPct(oneWeekAgoZScore),
    rangeStartPct: positionPct(rangeMin),
    rangeWidthPct:
      rangeMin === null || rangeMax === null
        ? null
        : toNumber(positionPct(rangeMax) - positionPct(rangeMin)),
  };
}

export function buildImpliedVolatilityRatioDashboardView(rows) {
  const visibleRows = rows
    .filter((row) => row.source_status === 'active' && toNumber(row.ivol_rvol_ratio_z_1y) !== null)
    .sort((left, right) => Number(right.ivol_rvol_ratio_z_1y) - Number(left.ivol_rvol_ratio_z_1y))
    .map(rowView);

  return {
    date: rows[0]?.date ?? null,
    domain: {
      minimum: DOMAIN_MIN,
      maximum: DOMAIN_MAX,
    },
    ticks: TICKS.map((value) => ({
      value,
      positionPct: positionPct(value),
    })),
    rows: visibleRows,
  };
}
