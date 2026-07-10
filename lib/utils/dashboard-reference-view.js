function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sortByDate(rows) {
  return [...(rows ?? [])].sort((left, right) => String(left.date ?? '').localeCompare(String(right.date ?? '')));
}

function seriesFor(rows, key) {
  return sortByDate(rows)
    .map((row) => toNumber(row[key]))
    .filter((value) => value !== null);
}

function changeForSessions(series, sessions) {
  if (series.length < 2) return null;
  const baselineIndex = Math.max(0, series.length - 1 - sessions);
  return series.at(-1) - series[baselineIndex];
}

function trendTone(change, { invert = false } = {}) {
  if (change === null || change === 0) return 'neutral';
  const positive = invert ? change < 0 : change > 0;
  return positive ? 'positive' : 'danger';
}

function averageStrength(rows) {
  const values = (rows ?? [])
    .map((row) => toNumber(row.strength))
    .filter((value) => value !== null);

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metric({ key, icon, label, value, valueType, changeType, series, invertTone = false, tone = null }) {
  const oneDayChange = changeForSessions(series, 1);
  const oneWeekChange = changeForSessions(series, 5);

  return {
    key,
    icon,
    label,
    value,
    valueType,
    oneDayChange,
    oneWeekChange,
    changeType,
    series,
    tone: tone ?? trendTone(oneWeekChange ?? oneDayChange, { invert: invertTone }),
  };
}

export function buildOverviewAction(headlineLabel) {
  switch (headlineLabel) {
    case 'Strong Risk-On':
    case 'Risk-On':
      return 'ÖKA EXPONERING';
    case 'Cautious Bullish':
      return 'ÖKA FÖRSIKTIGT';
    case 'Risk Warning':
    case 'Risk-Off':
      return 'MINSKA EXPONERING';
    default:
      return 'AVVAKTA';
  }
}

export function buildReferenceMarketMetrics({ latestSignal = {}, recentSignals = [], sectorRows = [] } = {}) {
  const breadthSeries = seriesFor(recentSignals, 'pct_above_50');
  const adLineSeries = seriesFor(recentSignals, 'ad_line');
  const vixSeries = seriesFor(recentSignals, 'vix');
  const highSeries = seriesFor(recentSignals, 'new_highs');
  const scoreSeries = seriesFor(recentSignals, 'market_regime_score');
  const strength = averageStrength(sectorRows);
  const regime = latestSignal.signal ?? null;

  return [
    metric({
      key: 'breadth',
      icon: 'users',
      label: 'BREDD (ÖVER MA50)',
      value: toNumber(latestSignal.pct_above_50),
      valueType: 'percent',
      changeType: 'points',
      series: breadthSeries,
    }),
    metric({
      key: 'adLine',
      icon: 'signal',
      label: 'A/D-LINE',
      value: toNumber(latestSignal.ad_line),
      valueType: 'number',
      changeType: 'number',
      series: adLineSeries,
    }),
    metric({
      key: 'vix',
      icon: 'shield',
      label: 'VIX',
      value: toNumber(latestSignal.vix),
      valueType: 'decimal',
      changeType: 'decimal',
      series: vixSeries,
      invertTone: true,
    }),
    metric({
      key: 'highs',
      icon: 'rocket',
      label: 'UTBROTT (52W)',
      value: toNumber(latestSignal.new_highs),
      valueType: 'number',
      changeType: 'number',
      series: highSeries,
    }),
    metric({
      key: 'strength',
      icon: 'target',
      label: 'RS-STYRKA (63D)',
      value: strength,
      valueType: 'percent',
      changeType: 'points',
      series: [],
      tone: 'neutral',
    }),
    metric({
      key: 'regime',
      icon: 'gauge',
      label: 'MARKNADSREGIM',
      value: regime,
      valueType: 'regime',
      changeType: 'number',
      series: scoreSeries,
      tone: regime === 'risk_on' ? 'positive' : regime === 'risk_off' ? 'danger' : 'neutral',
    }),
  ];
}
