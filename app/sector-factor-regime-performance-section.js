import { getSectorFactorRegimePerformanceSnapshot } from '../lib/repositories/macro-matrix-sector-factor-regime-performance.js';
import {
  formatMatrixMonth,
  formatRegimeStatus,
  MacroMatrixSlide,
  RegimePerformanceMatrix,
} from './macro-matrix-renderers.js';

export default async function SectorFactorRegimePerformanceSection() {
  const matrix = await getSectorFactorRegimePerformanceSnapshot();
  if (!matrix) return null;

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
