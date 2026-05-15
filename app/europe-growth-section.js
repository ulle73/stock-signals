import { getEuropeGrowthMatrixSnapshot } from '../lib/repositories/europe-growth-indicators.js';
import { MacroMatrixSlide, TimelineMacroMatrix } from './macro-matrix-renderers.js';

export default async function EuropeGrowthSection() {
  const matrix = await getEuropeGrowthMatrixSnapshot();
  if (!matrix) return null;

  return (
    <MacroMatrixSlide
      className="macro-slide-europe-growth"
      title="Europa: Tillväxtindikatorer"
      subtitle="Tillväxtdata kommer bli sämre innan det blir bättre på grund av höga baseffekter under Q2 och Q3. Vi kan kalla det för ekonomisk gravitation. Tjänstesektorn har klarat sig bättre när restriktioner lättat."
      footnote="Röda markeringsrutor visar samma baseffekt-idé som referensen: först låga jämförelsetal, därefter höga jämförelsetal. Saknade historiska datapunkter lämnas neutrala tills källan har fyllts."
    >
      <TimelineMacroMatrix
        matrix={matrix}
        rowHeader="Growth Indicators Europe"
        showQuarters
        showDelta
        valueDigits={2}
        annotationRanges={[
          { label: 'Låga jämförelsetal', left: '20%', width: '18%' },
          { label: 'Höga jämförelsetal', left: '55%', width: '20%' },
        ]}
      />
    </MacroMatrixSlide>
  );
}
