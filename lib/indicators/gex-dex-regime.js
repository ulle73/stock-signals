const NEAR_GAMMA_FLIP_ATR = 0.5;
const GEX_DEX_CONFLUENCE_ATR = 0.5;

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function distanceInAtr(spot, level, atr) {
  if (spot === null || level === null || atr === null || atr <= 0) return null;
  return round((spot - level) / atr);
}

function resolveGammaRegime(value) {
  const positioning = String(value ?? '').trim().toUpperCase();
  if (positioning.includes('POSITIVE GAMMA')) return 'positive';
  if (positioning.includes('NEGATIVE GAMMA')) return 'negative';
  return 'unknown';
}

function levelsAreAligned(first, second, atr) {
  if (first === null || second === null || atr === null || atr <= 0) return false;
  return Math.abs(first - second) <= atr * GEX_DEX_CONFLUENCE_ATR;
}

export function buildGexDexRegimeRows(snapshots) {
  return snapshots.map((snapshot) => {
    const spot = toFiniteNumber(snapshot.spot_price);
    const callWall = toFiniteNumber(snapshot.call_wall);
    const putWall = toFiniteNumber(snapshot.put_wall);
    const gammaFlip = toFiniteNumber(snapshot.gamma_flip);
    const dexResistance = toFiniteNumber(snapshot.dex_resistance);
    const dexSupport = toFiniteNumber(snapshot.dex_support);
    const atr = toFiniteNumber(snapshot.atr_14);
    const gammaRegime = resolveGammaRegime(snapshot.dealer_positioning);
    const spotToGammaFlipAtr = distanceInAtr(spot, gammaFlip, atr);
    const spotToCallWallAtr = distanceInAtr(spot, callWall, atr);
    const spotToPutWallAtr = distanceInAtr(spot, putWall, atr);
    const hasWalls = callWall !== null && putWall !== null;
    const lowerWall = hasWalls ? Math.min(callWall, putWall) : null;
    const upperWall = hasWalls ? Math.max(callWall, putWall) : null;
    const insideWalls = hasWalls && spot !== null && spot >= lowerWall && spot <= upperWall;
    const aboveCallWall = callWall !== null && spot !== null && spot > callWall;
    const belowPutWall = putWall !== null && spot !== null && spot < putWall;
    const nearGammaFlip = spotToGammaFlipAtr !== null && Math.abs(spotToGammaFlipAtr) <= NEAR_GAMMA_FLIP_ATR;
    const gexDexConfluence =
      levelsAreAligned(callWall, dexResistance, atr) && levelsAreAligned(putWall, dexSupport, atr);
    const sourceIsUsable = snapshot.source_status === 'active' && snapshot.stale !== true;
    const hasRequiredLevels = spot !== null && gammaFlip !== null && atr !== null && atr > 0;

    let signal = 'neutral';
    if (!sourceIsUsable || !hasRequiredLevels || gammaRegime === 'unknown') {
      signal = 'unknown';
    } else if (nearGammaFlip) {
      signal = 'flip_risk';
    } else if (gammaRegime === 'negative' && (aboveCallWall || belowPutWall)) {
      signal = 'expansion';
    } else if (gammaRegime === 'positive' && insideWalls) {
      signal = 'range';
    }

    return {
      snapshot_id: snapshot.id,
      ticker: snapshot.ticker,
      gamma_regime: gammaRegime,
      spot_to_gamma_flip_atr: spotToGammaFlipAtr,
      spot_to_call_wall_atr: spotToCallWallAtr,
      spot_to_put_wall_atr: spotToPutWallAtr,
      inside_walls: insideWalls,
      near_gamma_flip: nearGammaFlip,
      above_call_wall: aboveCallWall,
      below_put_wall: belowPutWall,
      gex_dex_confluence: gexDexConfluence,
      gex_dex_signal: signal,
    };
  });
}
