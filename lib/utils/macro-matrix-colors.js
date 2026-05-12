const DEFAULT_NORMAL_MONTHLY_MOVE = 1;
const DEFAULT_NEUTRAL_LEVEL = 0;
const DEFAULT_LEVEL_SCALE = 5;
const DEFAULT_LEVEL_WEIGHT = 1;
const DEFAULT_CHANGE_WEIGHT = 0.35;
const DEFAULT_PMI_NEUTRAL_LEVEL = 50;
const DEFAULT_PMI_LEVEL_SCALE = 5;
const DEFAULT_PMI_CHANGE_WEIGHT = 0.45;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function signForDirection(direction) {
  return direction === 'lower_is_better' ? -1 : 1;
}

function keepLevelSide(current, neutralLevel, score) {
  if (current >= neutralLevel) return Math.max(0, score);
  return Math.min(0, score);
}

export function colorBucketFromRawScore(rawScore) {
  if (rawScore === null || rawScore === undefined) return 'neutral';

  if (rawScore >= 2.25) return 'blue-5';
  if (rawScore >= 1.55) return 'blue-4';
  if (rawScore >= 0.95) return 'blue-3';
  if (rawScore >= 0.45) return 'blue-2';
  if (rawScore > 0.12) return 'blue-1';
  if (rawScore <= -2.25) return 'red-5';
  if (rawScore <= -1.55) return 'red-4';
  if (rawScore <= -0.95) return 'red-3';
  if (rawScore <= -0.45) return 'red-2';
  if (rawScore < -0.12) return 'red-1';
  return 'neutral';
}

export function colorBucketFromHeatmapScore(heatmapScore) {
  if (heatmapScore === null || heatmapScore === undefined) return 'neutral';
  return colorBucketFromRawScore(Number(heatmapScore) * 2);
}

export function getMacroMatrixColorMetrics({
  value,
  previousValue,
  direction = 'higher_is_better',
  type = 'level_momentum',
  neutralLevel = DEFAULT_NEUTRAL_LEVEL,
  levelScale = DEFAULT_LEVEL_SCALE,
  levelWeight = DEFAULT_LEVEL_WEIGHT,
  normalMonthlyMove = DEFAULT_NORMAL_MONTHLY_MOVE,
  changeWeight = DEFAULT_CHANGE_WEIGHT,
  pmiLevelScale = DEFAULT_PMI_LEVEL_SCALE,
  pmiChangeWeight = DEFAULT_PMI_CHANGE_WEIGHT,
} = {}) {
  const current = toFiniteNumber(value);
  const previous = toFiniteNumber(previousValue);

  if (current === null) {
    return {
      momChange: null,
      rawColorScore: null,
      heatmapScore: null,
      directionScore: 0,
      colorBucket: 'missing',
    };
  }

  if (previous === null) {
    return {
      momChange: null,
      rawColorScore: null,
      heatmapScore: null,
      directionScore: 0,
      colorBucket: 'neutral',
    };
  }

  const momChange = current - previous;
  const directionSign = signForDirection(direction);
  const moveScale = Math.abs(Number(normalMonthlyMove)) || DEFAULT_NORMAL_MONTHLY_MOVE;
  const resolvedLevelScale = Math.abs(Number(levelScale)) || DEFAULT_LEVEL_SCALE;
  let rawColorScore;

  if (type === 'pmi' || direction === 'pmi') {
    const pmiNeutral = toFiniteNumber(neutralLevel) ?? DEFAULT_PMI_NEUTRAL_LEVEL;
    const pmiScale = Math.abs(Number(pmiLevelScale)) || DEFAULT_PMI_LEVEL_SCALE;
    const levelScore = (current - pmiNeutral) / pmiScale;
    const changeScore = momChange / moveScale;
    const combinedScore = levelScore + (pmiChangeWeight * changeScore);

    rawColorScore = keepLevelSide(current, pmiNeutral, combinedScore);
  } else if (type === 'momentum') {
    rawColorScore = (momChange * directionSign) / moveScale;
  } else {
    const levelScore = ((current - neutralLevel) * directionSign) / resolvedLevelScale;
    const changeScore = (momChange * directionSign) / moveScale;
    rawColorScore = (levelWeight * levelScore) + (changeWeight * changeScore);
  }

  const heatmapScore = clamp(rawColorScore / 2, -1, 1);

  return {
    momChange,
    rawColorScore,
    heatmapScore,
    directionScore: rawColorScore > 0.12 ? 1 : rawColorScore < -0.12 ? -1 : 0,
    colorBucket: colorBucketFromRawScore(rawColorScore),
  };
}
