import { getGlobalManufacturingPmiMatrixSnapshot } from '../lib/repositories/global-manufacturing-pmi.js';
import { MacroMatrixSlide, TimelineMacroMatrix } from './macro-matrix-renderers.js';

const GLOBAL_PMI_GROUPS = [
  {
    key: 'major_regions',
    label: 'Major Regions',
    rowKeys: ['world', 'united_states', 'china', 'euro_area'],
  },
  {
    key: 'eurozone',
    label: 'EuroZone',
    rowKeys: ['denmark', 'france', 'germany', 'greece', 'italy', 'netherlands', 'spain', 'sweden', 'switzerland'],
  },
  {
    key: 'asia',
    label: 'Asia',
    rowKeys: ['india', 'indonesia', 'japan', 'malaysia', 'philippines', 'taiwan', 'thailand', 'vietnam'],
  },
];

export default async function GlobalManufacturingPmiSection() {
  const matrix = await getGlobalManufacturingPmiMatrixSnapshot();
  if (!matrix) return null;

  return (
    <MacroMatrixSlide
      className="macro-slide-global-pmi"
      title="Industri-PMI faller från höga nivåer"
      subtitle="Även framåtblickande PMI-data faller tillbaka när inköpscheferna ser svagare mindre optimistiska utsikter."
      footnote="Färgskalan följer PMI-logiken i bilden: nivå över/under 50 kombineras med månadsmomentum. Gruppsummeringen visar andelen rader som förbättras M/M."
    >
      <TimelineMacroMatrix
        matrix={matrix}
        rowHeader="Major Regions"
        showQuarters={false}
        showDelta
        valueDigits={2}
        groups={GLOBAL_PMI_GROUPS}
      />
    </MacroMatrixSlide>
  );
}
