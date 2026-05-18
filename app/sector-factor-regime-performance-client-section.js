'use client';

import { useEffect, useState } from 'react';
import {
  formatMatrixMonth,
  formatRegimeStatus,
  MacroMatrixSlide,
  RegimePerformanceMatrix,
} from './macro-matrix-renderers.js';

function LoadingCard({ title, copy }) {
  return (
    <MacroMatrixSlide
      className="regime-stat-card macro-slide-regime-performance"
      title={title}
      subtitle={copy}
      footnote="Sektionen laddas separat efter första renderingen för att inte blockera hela dashboarden."
    >
      <p className="hero-copy compact">
        Matrisen laddas i en egen begäran så att resten av sidan förblir användbar under tiden.
      </p>
    </MacroMatrixSlide>
  );
}

export default function SectorFactorRegimePerformanceClientSection() {
  const [matrix, setMatrix] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch('/api/sector-factor-regime-performance', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!active) return;

        setMatrix(payload);
        setStatus('ready');
      } catch (error) {
        console.error('Sector factor regime matrix load failed:', error);
        if (!active) return;
        setStatus('error');
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  if (status === 'loading') {
    return (
      <LoadingCard
        title="Vilka sektorer och faktorstilar fungerar?"
        copy="Sektormatrisen laddas efter första renderingen så att dashboarden inte fastnar på vägen in."
      />
    );
  }

  if (status === 'error' || !matrix) {
    return (
      <LoadingCard
        title="Vilka sektorer och faktorstilar fungerar?"
        copy="Sektionen kunde inte laddas nu. Testa att ladda om sidan eller synka matrisdatan igen."
      />
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
