const SCALE = 1_000_000n;

export const DEFAULT_INDICATOR_WINDOWS = [
  { key: 'sma5', size: 5 },
  { key: 'sma10', size: 10 },
  { key: 'sma20', size: 20 },
  { key: 'sma50', size: 50 },
  { key: 'sma200', size: 200 },
];

export const DERIVED_INDICATOR_KEYS = [
  'daily_return_pct',
  'avg_volume20',
  'relative_volume20',
  'pct_from_52w_high',
  'pct_from_52w_low',
];

export const DEFAULT_VOLUME_WINDOW_SIZE = 20;
export const DEFAULT_HIGH_LOW_WINDOW_SIZE = 252;

function parseScaledNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = typeof value === 'number'
    ? value.toFixed(6)
    : String(value).trim();

  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = match[2];
  const fraction = (match[3] ?? '').padEnd(6, '0').slice(0, 6);

  return sign * BigInt(`${whole}${fraction}`);
}

function scaledToString(value) {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / SCALE;
  const fraction = String(absolute % SCALE).padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

function scaledToNumber(value) {
  return Number(scaledToString(value));
}

function divideRounded(numerator, denominator) {
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;

  if (remainder !== 0n) {
    const remainderAbs = remainder < 0n ? -remainder : remainder;
    const denominatorAbs = denominator < 0n ? -denominator : denominator;
    if (remainderAbs * 2n >= denominatorAbs) {
      quotient += (numerator > 0n) === (denominator > 0n) ? 1n : -1n;
    }
  }

  return quotient;
}

function divideScaledSum(sum, divisor) {
  return divideRounded(sum, BigInt(divisor));
}

function computeRatioScaled(currentScaled, baselineScaled) {
  return divideRounded(currentScaled * SCALE, baselineScaled);
}

function computePercentDifferenceScaled(currentScaled, baselineScaled) {
  return (computeRatioScaled(currentScaled, baselineScaled) - SCALE) * 100n;
}

function maxFromArray(values) {
  let max = values[0];

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > max) {
      max = values[index];
    }
  }

  return max;
}

function minFromArray(values) {
  let min = values[0];

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < min) {
      min = values[index];
    }
  }

  return min;
}

export function getIndicatorPrice(row) {
  const scaled = parseScaledNumeric(row.adj_close ?? row.close);

  if (scaled === null) {
    throw new Error(`No usable indicator price for ${row.ticker} on ${row.date}`);
  }

  return scaledToNumber(scaled);
}

export function formatIndicatorValueForStorage(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const scaled = parseScaledNumeric(value);
  return scaledToString(scaled);
}

export function calculateTickerIndicators(
  rows,
  indicatorWindows = DEFAULT_INDICATOR_WINDOWS,
  {
    volumeWindowSize = DEFAULT_VOLUME_WINDOW_SIZE,
    highLowWindowSize = DEFAULT_HIGH_LOW_WINDOW_SIZE,
  } = {}
) {
  const stateByKey = new Map(
    indicatorWindows.map((window) => [
      window.key,
      {
        size: window.size,
        values: [],
        sum: 0n,
      },
    ])
  );
  const volumeState = {
    values: [],
    sum: 0n,
    nullCount: 0,
  };
  const highLowWindow = [];
  let previousPriceScaled = null;

  return rows.map((row) => {
    const indicatorPriceScaled = parseScaledNumeric(row.adj_close ?? row.close);
    const volumeScaled = parseScaledNumeric(row.volume);

    if (indicatorPriceScaled === null) {
      throw new Error(`No usable indicator price for ${row.ticker} on ${row.date}`);
    }

    const indicatorRow = {
      ticker: row.ticker,
      date: row.date,
      indicator_price: scaledToNumber(indicatorPriceScaled),
    };

    indicatorRow.daily_return_pct = previousPriceScaled && previousPriceScaled !== 0n
      ? scaledToNumber(computePercentDifferenceScaled(indicatorPriceScaled, previousPriceScaled))
      : null;

    volumeState.values.push(volumeScaled);
    if (volumeScaled === null) {
      volumeState.nullCount += 1;
    } else {
      volumeState.sum += volumeScaled;
    }

    if (volumeState.values.length > volumeWindowSize) {
      const removed = volumeState.values.shift();
      if (removed === null) {
        volumeState.nullCount -= 1;
      } else {
        volumeState.sum -= removed;
      }
    }

    const avgVolumeScaled = volumeState.values.length === volumeWindowSize && volumeState.nullCount === 0
      ? divideScaledSum(volumeState.sum, volumeWindowSize)
      : null;

    indicatorRow.avg_volume20 = avgVolumeScaled === null
      ? null
      : scaledToNumber(avgVolumeScaled);

    indicatorRow.relative_volume20 = avgVolumeScaled !== null && avgVolumeScaled !== 0n && volumeScaled !== null
      ? scaledToNumber(computeRatioScaled(volumeScaled, avgVolumeScaled))
      : null;

    highLowWindow.push(indicatorPriceScaled);
    if (highLowWindow.length > highLowWindowSize) {
      highLowWindow.shift();
    }

    if (highLowWindow.length === highLowWindowSize) {
      const highestPriceScaled = maxFromArray(highLowWindow);
      const lowestPriceScaled = minFromArray(highLowWindow);

      indicatorRow.pct_from_52w_high = scaledToNumber(
        computePercentDifferenceScaled(indicatorPriceScaled, highestPriceScaled)
      );
      indicatorRow.pct_from_52w_low = scaledToNumber(
        computePercentDifferenceScaled(indicatorPriceScaled, lowestPriceScaled)
      );
    } else {
      indicatorRow.pct_from_52w_high = null;
      indicatorRow.pct_from_52w_low = null;
    }

    for (const window of indicatorWindows) {
      const state = stateByKey.get(window.key);
      state.values.push(indicatorPriceScaled);
      state.sum += indicatorPriceScaled;

      if (state.values.length > state.size) {
        state.sum -= state.values.shift();
      }

      indicatorRow[window.key] = state.values.length === state.size
        ? scaledToNumber(divideScaledSum(state.sum, state.size))
        : null;
    }

    previousPriceScaled = indicatorPriceScaled;

    return indicatorRow;
  });
}
