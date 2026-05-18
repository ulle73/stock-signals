import { getSectorFactorRegimePerformanceSnapshot } from '../lib/repositories/macro-matrix-sector-factor-regime-performance.js';
import {
  formatMatrixMonth,
  formatRegimeStatus,
  MacroMatrixSlide,
  RegimePerformanceMatrix,
} from './macro-matrix-renderers.js';

const CACHE_TTL_MS = 30 * 60 * 1000;

let cachedMatrix = null;
let cachedAt = 0;
let pendingMatrixPromise = null;

function warmSectorFactorMatrix() {
  if (pendingMatrixPromise) {
    return pendingMatrixPromise;
  }

  pendingMatrixPromise = getSectorFactorRegimePerformanceSnapshot()
    .then((matrix) => {
      cachedMatrix = matrix;
      cachedAt = Date.now();
      return matrix;
    })
    .catch((error) => {
      console.error('Sector factor regime matrix warmup failed:', error);
      return null;
    })
    .finally(() => {
      pendingMatrixPromise = null;
    });

  return pendingMatrixPromise;
}

export default async function SectorFactorRegimePerformanceSection() {
  const isFresh = cachedMatrix && (Date.now() - cachedAt) < CACHE_TTL_MS;
  if (!isFresh) {
    void warmSectorFactorMatrix();
  }

  const matrix = cachedMatrix;
  if (!matrix) {
    return (
      <MacroMatrixSlide
        className="regime-stat-card macro-slide-regime-performance"
        title="Vilka sektorer och faktorstilar fungerar?"
        subtitle="Sektormatrisen värms i bakgrunden första gången för att inte blockera hela dashboarden."
        footnote="Ladda om sidan efter en stund så visas hela regime performance-matrisen med alla proxyserier."
      >
        <p className="hero-copy compact">
          Live-proxyerna från Yahoo hämtas i bakgrunden. Under tiden prioriteras att resten av
          dashboarden blir användbar direkt.
        </p>
      </MacroMatrixSlide>
    );
  }

  return (
    <MacroMatrixSlide
      className="regime-stat-card macro-slide-regime-performance"
      title="Vilka sektorer och faktorstilar fungerar?"
      subtitle="Förutom att hitta det som brukar utvecklas väl så hjälper marknadsregimerna oss med att undvika det som brukar underprestera. Undvika förlorare är minst lika viktigt som att hitta vinnare."
      footnote={`Beta räknas mot ${matrix.benchmarkLabel ?? 'OMXS30-proxy'}. Aktuell regim är ${formatRegimeStatus(matrix.currentRegime)} per ${formatMatrixMonth(matrix.asOfDate)}. Där exakta index inte är gratis eller fetchbara används explicit ETF-, futures- eller FX-proxy.`}
    >
      <RegimePerformanceMatrix matrix={matrix} rowHeader="Markets" />
    </MacroMatrixSlide>
  );
}
