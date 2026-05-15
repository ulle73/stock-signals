import { MacroMatrixSlide, TimelineMacroMatrix } from './macro-matrix-renderers.js';

export default function UsGrowthSection({ matrix }) {
  if (!matrix) return null;

  return (
    <MacroMatrixSlide
      className="macro-slide-us-growth"
      title="Högfrekvent tillväxtdata: USA"
      subtitle="Fredagens jobbdata bättre än väntat. Veckans höjdpunkt från USA är onsdagens KPI-data där det ligger i förväntningarna en nedgång till 8,1% i april från 8,5% i mars. Kärn-KPI väntas falla till 6,0% från 6,5%."
      caption={(
        <>
          <strong>Tabell</strong>
          <span>Högfrekvent tillväxtdata USA</span>
        </>
      )}
      footnote="Färgerna följer value-range och momentum: stark teal betyder tydligt positiv/accelererande data, stark röd tydligt negativ/försvagande data. Delta-kolumnen visar senaste månadens förändring."
    >
      <TimelineMacroMatrix
        matrix={matrix}
        rowHeader="Growth Indicators US"
        showQuarters
        showDelta
        valueDigits={2}
      />
    </MacroMatrixSlide>
  );
}
