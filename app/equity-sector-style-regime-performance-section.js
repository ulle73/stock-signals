import { getEquitySectorStyleRegimePerformanceSnapshot } from '../lib/repositories/macro-matrix-equity-sector-style-regime-performance.js';
import {
  formatMatrixMonth,
  formatRegimeStatus,
  MacroMatrixSlide,
  RegimePerformanceMatrix,
} from './macro-matrix-renderers.js';

function equityRowBucket(row) {
  if (row.region === 'Europe') return 'euro';
  if (row.region === 'Sweden') return 'omx';
  if (row.region === 'US') return 'sp500';
  return 'neutral';
}

export default async function EquitySectorStyleRegimePerformanceSection() {
  const matrix = await getEquitySectorStyleRegimePerformanceSnapshot();
  if (!matrix) return null;

  return (
    <MacroMatrixSlide
      className="regime-stat-card macro-slide-equity-regime-performance"
      title="Vilka sektorer och faktorstilar fungerar?"
      subtitle="Inget facit på hur vi agerar, men bra vägledning på vad som brukar fungerar i de olika marknadsregimerna. Alla cykler är annorlunda och det gäller att lyssna på marknadens budskap."
      footnote={`Equity-tabellen visar samma sju block som referensen: average/median returns, volatility, Sharpe, win ratio, beta med OMXS30 och observationer. Aktuell regim är ${formatRegimeStatus(matrix.currentRegime)} per ${formatMatrixMonth(matrix.asOfDate)}.`}
    >
      <RegimePerformanceMatrix
        matrix={matrix}
        rowHeader="Sector & Style Factor"
        rowBucket={equityRowBucket}
      />
    </MacroMatrixSlide>
  );
}
