function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatPercent(value, digits = 1) {
  const number = toNumber(value);
  if (number === null) return 'No data';
  return `${number.toFixed(digits)}%`;
}

function formatPoints(value, digits = 1) {
  const number = toNumber(value);
  if (number === null) return 'No data';
  const sign = number > 0 ? '+' : '';
  return `${sign}${number.toFixed(digits)} pp`;
}

function formatSignedPercent(value, digits = 1) {
  const number = toNumber(value);
  if (number === null) return 'No data';
  const sign = number > 0 ? '+' : '';
  return `${sign}${number.toFixed(digits)}%`;
}

function normalizeScore(rawScore) {
  const score = toNumber(rawScore);
  if (score === null) return null;

  // Current model is an additive score, usually around -4 to +7.
  // Map it to a readable 0-100 display score without changing the saved model yet.
  const normalized = ((score + 4) / 11) * 100;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function scoreLabel(displayScore) {
  if (displayScore === null) return { label: 'No signal', tone: 'neutral', emoji: '⚪' };
  if (displayScore >= 80) return { label: 'Strong Risk-On', tone: 'positive', emoji: '🟢' };
  if (displayScore >= 65) return { label: 'Risk-On', tone: 'positive', emoji: '🟢' };
  if (displayScore >= 55) return { label: 'Cautious Bullish', tone: 'caution', emoji: '🟡' };
  if (displayScore >= 45) return { label: 'Neutral', tone: 'neutral', emoji: '⚪' };
  if (displayScore >= 30) return { label: 'Risk Warning', tone: 'warning', emoji: '🟠' };
  return { label: 'Risk-Off', tone: 'danger', emoji: '🔴' };
}

function termLabel(signal, displayScore) {
  if (signal === 'risk_on' && displayScore >= 65) return { label: 'Risk-On', tone: 'positive' };
  if (signal === 'risk_off' || displayScore < 35) return { label: 'Risk-Off', tone: 'danger' };
  if (displayScore >= 55) return { label: 'Cautious Bullish', tone: 'caution' };
  if (displayScore >= 45) return { label: 'Neutral', tone: 'neutral' };
  return { label: 'Warning', tone: 'warning' };
}

function classifyShortTerm(signal) {
  const spx3d = toNumber(signal?.spx_3d_change);
  const breadth3d = toNumber(signal?.pct_above_50_3d_change);
  const shortDivergence = signal?.short_divergence_status;

  if (shortDivergence === 'short_negative') {
    return { label: 'Weakening', tone: 'warning', detail: 'SPX is up short-term, but SMA50 breadth is falling.' };
  }

  if (shortDivergence === 'short_positive') {
    return { label: 'Improving', tone: 'positive', detail: 'SPX is down short-term, but breadth is improving.' };
  }

  if (spx3d !== null && breadth3d !== null && spx3d > 0 && breadth3d > 0) {
    return { label: 'Bullish', tone: 'positive', detail: 'Price and breadth are rising together over 3 sessions.' };
  }

  if (spx3d !== null && breadth3d !== null && spx3d < 0 && breadth3d < 0) {
    return { label: 'Bearish', tone: 'danger', detail: 'Price and breadth are falling together over 3 sessions.' };
  }

  return { label: 'Neutral', tone: 'neutral', detail: 'No strong 3-session price/breadth edge.' };
}

function classifySwingTerm(signal) {
  const spx14d = toNumber(signal?.spx_14d_change);
  const breadth14d = toNumber(signal?.pct_above_50_14d_change);
  const divergence = signal?.divergence_status;

  if (divergence === 'bearish_warning_strong') {
    return { label: 'Strong Warning', tone: 'danger', detail: '14-day bearish divergence is confirmed by additional risk factors.' };
  }

  if (divergence === 'bearish_warning') {
    return { label: 'Warning', tone: 'warning', detail: 'SPX is rising while SMA50 breadth is weakening.' };
  }

  if (divergence === 'bullish_divergence') {
    return { label: 'Recovery Watch', tone: 'positive', detail: 'SPX is weak but breadth is improving underneath.' };
  }

  if (spx14d !== null && breadth14d !== null && spx14d > 0 && breadth14d > 0) {
    return { label: 'Bullish', tone: 'positive', detail: 'SPX and SMA50 breadth are both improving over 14 sessions.' };
  }

  if (spx14d !== null && breadth14d !== null && spx14d < 0 && breadth14d < 0) {
    return { label: 'Bearish', tone: 'danger', detail: 'SPX and breadth are both weakening over 14 sessions.' };
  }

  return { label: 'Mixed', tone: 'caution', detail: '14-session price and breadth signals are mixed.' };
}

function classifyPositionTerm(signal) {
  const pctAbove200 = toNumber(signal?.pct_above_200);
  const vix = toNumber(signal?.vix);

  if (pctAbove200 !== null && pctAbove200 >= 60 && (vix === null || vix < 22)) {
    return { label: 'Risk-On', tone: 'positive', detail: 'A majority of S&P 500 stocks are above SMA200 and volatility is controlled.' };
  }

  if (pctAbove200 !== null && pctAbove200 >= 50) {
    return { label: 'Constructive', tone: 'caution', detail: 'Long-term breadth is above neutral, but not strongly risk-on.' };
  }

  if (pctAbove200 !== null && pctAbove200 < 40) {
    return { label: 'Risk-Off', tone: 'danger', detail: 'Long-term breadth is structurally weak.' };
  }

  return { label: 'Neutral', tone: 'neutral', detail: 'Long-term breadth is not giving a clear edge.' };
}

function buildIndicatorHeatmap(signal) {
  const spx14d = toNumber(signal?.spx_14d_change);
  const pctAbove50 = toNumber(signal?.pct_above_50);
  const pctAbove50_14d = toNumber(signal?.pct_above_50_14d_change);
  const pctAbove200 = toNumber(signal?.pct_above_200);
  const ad14d = toNumber(signal?.ad_line_14d_change);
  const newHighs = toNumber(signal?.new_highs);
  const newLows = toNumber(signal?.new_lows);
  const vix = toNumber(signal?.vix);

  return [
    {
      key: 'spx14d',
      label: 'SPX 14d',
      value: formatSignedPercent(spx14d),
      tone: spx14d === null ? 'neutral' : spx14d > 0 ? 'positive' : spx14d < 0 ? 'danger' : 'neutral',
    },
    {
      key: 'sma50',
      label: '% > SMA50',
      value: formatPercent(pctAbove50),
      tone: pctAbove50 === null ? 'neutral' : pctAbove50 >= 60 ? 'positive' : pctAbove50 >= 50 ? 'caution' : pctAbove50 >= 45 ? 'warning' : 'danger',
    },
    {
      key: 'sma50trend',
      label: 'SMA50 14d',
      value: formatPoints(pctAbove50_14d),
      tone: pctAbove50_14d === null ? 'neutral' : pctAbove50_14d > 3 ? 'positive' : pctAbove50_14d < -5 ? 'warning' : 'neutral',
    },
    {
      key: 'sma200',
      label: '% > SMA200',
      value: formatPercent(pctAbove200),
      tone: pctAbove200 === null ? 'neutral' : pctAbove200 >= 60 ? 'positive' : pctAbove200 >= 50 ? 'caution' : pctAbove200 >= 40 ? 'warning' : 'danger',
    },
    {
      key: 'adline',
      label: 'A/D 14d',
      value: ad14d === null ? 'No data' : `${ad14d > 0 ? '+' : ''}${Math.round(ad14d)}`,
      tone: ad14d === null ? 'neutral' : ad14d > 0 ? 'positive' : ad14d < 0 ? 'warning' : 'neutral',
    },
    {
      key: 'nhnl',
      label: 'NH / NL',
      value: newHighs === null || newLows === null ? 'No data' : `${newHighs} / ${newLows}`,
      tone: newHighs === null || newLows === null ? 'neutral' : newHighs > newLows ? 'positive' : newHighs < newLows ? 'danger' : 'neutral',
    },
    {
      key: 'vix',
      label: 'VIX',
      value: vix === null ? 'No data' : vix.toFixed(1),
      tone: vix === null ? 'neutral' : vix <= 18 ? 'positive' : vix < 25 ? 'caution' : 'danger',
    },
    {
      key: 'divergence',
      label: 'Divergence',
      value: readableStatus(signal?.divergence_status),
      tone: signal?.divergence_status === 'none' ? 'positive' : signal?.divergence_status === 'bullish_divergence' ? 'positive' : signal?.divergence_status === 'bearish_warning_strong' ? 'danger' : 'warning',
    },
  ];
}

function readableStatus(value) {
  if (!value) return 'No data';
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildExplanation(signal) {
  const bullets = [];
  const warnings = [];
  const pctAbove50 = toNumber(signal?.pct_above_50);
  const pctAbove200 = toNumber(signal?.pct_above_200);
  const spx14d = toNumber(signal?.spx_14d_change);
  const breadth14d = toNumber(signal?.pct_above_50_14d_change);
  const newHighs = toNumber(signal?.new_highs);
  const newLows = toNumber(signal?.new_lows);
  const vix = toNumber(signal?.vix);

  if (spx14d !== null) {
    bullets.push(`SPX 14d trend is ${formatSignedPercent(spx14d)}.`);
  }

  if (pctAbove50 !== null) {
    bullets.push(`${formatPercent(pctAbove50)} of S&P 500 stocks are above SMA50.`);
  }

  if (pctAbove200 !== null) {
    bullets.push(`${formatPercent(pctAbove200)} of S&P 500 stocks are above SMA200.`);
  }

  if (newHighs !== null && newLows !== null) {
    bullets.push(`New highs/lows are ${newHighs}/${newLows}.`);
  }

  if (vix !== null) {
    bullets.push(`VIX is ${vix.toFixed(1)}.`);
  }

  if (breadth14d !== null && breadth14d < -5) {
    warnings.push(`SMA50 breadth is down ${formatPoints(breadth14d)} over 14 sessions.`);
  }

  if (signal?.divergence_status?.includes('bearish')) {
    warnings.push('Price/breadth divergence is active: SPX is stronger than underlying participation.');
  }

  if (signal?.short_divergence_status === 'short_negative') {
    warnings.push('Short-term negative divergence is active over 3 sessions.');
  }

  return { bullets, warnings };
}

function buildPriceBreadthSummary(signal) {
  const spx14d = toNumber(signal?.spx_14d_change);
  const breadth14d = toNumber(signal?.pct_above_50_14d_change);
  const divergence = signal?.divergence_status;

  if (spx14d === null || breadth14d === null) {
    return {
      label: 'No price/breadth read yet',
      tone: 'neutral',
      detail: 'Need both SPX 14d change and SMA50 breadth 14d change.',
      spx: 'No data',
      breadth: 'No data',
    };
  }

  if (divergence === 'bearish_warning_strong') {
    return {
      label: 'Strong bearish divergence',
      tone: 'danger',
      detail: 'SPX is rising while breadth weakens and other risk factors confirm.',
      spx: formatSignedPercent(spx14d),
      breadth: formatPoints(breadth14d),
    };
  }

  if (divergence === 'bearish_warning') {
    return {
      label: 'Mild bearish divergence',
      tone: 'warning',
      detail: 'SPX is rising, but fewer stocks are participating.',
      spx: formatSignedPercent(spx14d),
      breadth: formatPoints(breadth14d),
    };
  }

  if (divergence === 'bullish_divergence') {
    return {
      label: 'Bullish breadth recovery',
      tone: 'positive',
      detail: 'SPX is weak, but breadth is improving under the surface.',
      spx: formatSignedPercent(spx14d),
      breadth: formatPoints(breadth14d),
    };
  }

  return {
    label: spx14d >= 0 && breadth14d >= 0 ? 'Price and breadth confirm' : 'Mixed price/breadth',
    tone: spx14d >= 0 && breadth14d >= 0 ? 'positive' : 'caution',
    detail: spx14d >= 0 && breadth14d >= 0
      ? 'SPX and SMA50 breadth are moving in the same positive direction.'
      : 'SPX and SMA50 breadth are not strongly aligned.',
    spx: formatSignedPercent(spx14d),
    breadth: formatPoints(breadth14d),
  };
}

function buildActionBias(label) {
  switch (label) {
    case 'Strong Risk-On':
      return 'Aggressive long-bias. Dips can be bought if price action confirms.';
    case 'Risk-On':
      return 'Long-bias. Hold winners and prefer pullback entries over chasing.';
    case 'Cautious Bullish':
      return 'Long-bias, but reduce size until breadth confirms more clearly.';
    case 'Neutral':
      return 'No strong edge. Prefer shorter trades and wait for confirmation.';
    case 'Risk Warning':
      return 'Reduce risk, tighten stops, and avoid adding heavy long exposure.';
    case 'Risk-Off':
      return 'Defensive stance. Avoid new aggressive longs until breadth recovers.';
    default:
      return 'No action bias available yet.';
  }
}

export function interpretMarketSignal(signal) {
  const displayScore = normalizeScore(signal?.market_regime_score);
  const headline = scoreLabel(displayScore);
  const shortTerm = classifyShortTerm(signal);
  const swingTerm = classifySwingTerm(signal);
  const positionTerm = classifyPositionTerm(signal);
  const explanation = buildExplanation(signal);
  const priceBreadth = buildPriceBreadthSummary(signal);

  return {
    displayScore,
    rawScore: toNumber(signal?.market_regime_score),
    headlineLabel: headline.label,
    emoji: headline.emoji,
    tone: headline.tone,
    actionBias: buildActionBias(headline.label),
    shortTerm,
    swingTerm,
    positionTerm,
    explanationBullets: explanation.bullets,
    warningBullets: explanation.warnings,
    priceBreadth,
    heatmap: buildIndicatorHeatmap(signal),
  };
}
