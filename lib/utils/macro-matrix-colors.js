const DEFAULT_NORMAL_MONTHLY_MOVE = 1;
const DEFAULT_PMI_NEUTRAL_LEVEL = 50;
const DEFAULT_PMI_LEVEL_SCALE = 5;
const DEFAULT_PMI_CHANGE_WEIGHT = 0.75;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function colorBucketFromRawScore(rawScore) {
  if (rawScore === null || rawScore === undefined) return 'neutral';

  if (rawScore >= 2) return 'blue-5';
  if (rawScore >= 1.25) return 'blue-4';
  if (rawScore >= 0.75) return 'blue-3';
  if (rawScore >= 0.35) return 'blue-2';
  if (rawScore > 0.05) return 'blue-1';
  if (rawScore <= -2) return 'red-5';
  if (rawScore <= -1.25) return 'red-4';
  if (rawScore <= -0.75) return 'red-3';
  if (rawScore <= -0.35) return 'red-2';
  if (rawScore < -0.05) return 'red-1';
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
  type = 'momentum',
  neutralLevel = DEFAULT_PMI_NEUTRAL_LEVEL,
  normalMonthlyMove = DEFAULT_NORMAL_MONTHLY_MOVE,
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
  const moveScale = Math.abs(Number(normalMonthlyMove)) || DEFAULT_NORMAL_MONTHLY_MOVE;
  let rawColorScore;

  if (type === 'pmi' || direction === 'pmi') {
    const levelScore = (current - neutralLevel) / (Math.abs(Number(pmiLevelScale)) || DEFAULT_PMI_LEVEL_SCALE);
    const changeScore = momChange / moveScale;
    const combinedScore = levelScore + (pmiChangeWeight * changeScore);

    rawColorScore = current >= neutralLevel
      ? Math.max(0, combinedScore)
      : Math.min(0, combinedScore);
  } else {
    const signedChange = direction === 'lower_is_better' ? -momChange : momChange;
    rawColorScore = signedChange / moveScale;
  }

  const heatmapScore = clamp(rawColorScore / 2, -1, 1);

  return {
    momChange,
    rawColorScore,
    heatmapScore,
    directionScore: rawColorScore > 0.05 ? 1 : rawColorScore < -0.05 ? -1 : 0,
    colorBucket: colorBucketFromRawScore(rawColorScore),
  };
}
