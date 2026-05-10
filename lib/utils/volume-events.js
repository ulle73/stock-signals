const HIGH_VOLUME_RVOL = 1.5;
const EXTREME_VOLUME_RVOL = 3;
const LOW_VOLUME_RVOL = 0.8;
const STRONG_UP_DAY_PCT = 1.5;
const STRONG_DOWN_DAY_PCT = -1.5;
const PANIC_DOWN_DAY_PCT = -2.5;
const DOWNTREND_20D_PCT = -8;
const WIDE_RANGE_PCT = 3;
const SMALL_BODY_PCT = 0.8;

export const VOLUME_EVENT_LABELS = {
  possible_capitulation: 'Possible capitulation',
  possible_exhaustion: 'Possible exhaustion',
  accumulation: 'Accumulation',
  distribution: 'Distribution',
  weak_upside_confirmation: 'Weak upside',
  normal: 'Normal volume',
};

function hasNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function classifyVolumeEvent(indicatorRow) {
  const rvol = indicatorRow.relative_volume20;
  const dayReturn = indicatorRow.daily_return_pct;
  const trend20 = indicatorRow.trend_20d_pct;
  const rangePct = indicatorRow.range_pct;
  const bodyPct = indicatorRow.body_pct;

  if (!hasNumber(rvol) || !hasNumber(dayReturn)) {
    return { volume_event: 'normal', volume_event_tone: 'neutral' };
  }

  const belowMovingAverage = (
    !hasNumber(indicatorRow.sma20) || indicatorRow.indicator_price < indicatorRow.sma20
  ) && (
    !hasNumber(indicatorRow.sma50) || indicatorRow.indicator_price < indicatorRow.sma50
  );

  if (
    rvol >= EXTREME_VOLUME_RVOL &&
    dayReturn <= PANIC_DOWN_DAY_PCT &&
    hasNumber(trend20) &&
    trend20 <= DOWNTREND_20D_PCT &&
    belowMovingAverage
  ) {
    return { volume_event: 'possible_capitulation', volume_event_tone: 'danger' };
  }

  if (
    rvol >= EXTREME_VOLUME_RVOL &&
    hasNumber(rangePct) &&
    hasNumber(bodyPct) &&
    rangePct >= WIDE_RANGE_PCT &&
    bodyPct <= SMALL_BODY_PCT
  ) {
    return { volume_event: 'possible_exhaustion', volume_event_tone: 'warning' };
  }

  if (rvol >= HIGH_VOLUME_RVOL && dayReturn >= STRONG_UP_DAY_PCT) {
    return { volume_event: 'accumulation', volume_event_tone: 'positive' };
  }

  if (rvol >= HIGH_VOLUME_RVOL && dayReturn <= STRONG_DOWN_DAY_PCT) {
    return { volume_event: 'distribution', volume_event_tone: 'danger' };
  }

  if (rvol <= LOW_VOLUME_RVOL && dayReturn >= 1) {
    return { volume_event: 'weak_upside_confirmation', volume_event_tone: 'caution' };
  }

  return { volume_event: 'normal', volume_event_tone: 'neutral' };
}

export function getVolumeEventLabel(volumeEvent) {
  return VOLUME_EVENT_LABELS[volumeEvent] ?? VOLUME_EVENT_LABELS.normal;
}
