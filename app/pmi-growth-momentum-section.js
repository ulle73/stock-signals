import { getMacroMatrixPmiGrowthSnapshot } from '../lib/repositories/macro-matrix-pmi-growth.js';
import { MacroMatrixSlide, TimelineMacroMatrix } from './macro-matrix-renderers.js';

const HIGHLIGHT_SERVICE_PMI_KEYS = [
  'service_pmi_new_orders',
  'service_pmi_business_activity',
  'service_pmi_total',
];

export default async function PmiGrowthMomentumSection() {
  const matrix = await getMacroMatrixPmiGrowthSnapshot({ monthCount: 27, quarterCount: 0 });
  if (!matrix) return null;

  return (
    <MacroMatrixSlide
      className="macro-slide-pmi-growth"
      title="Industri-PMI ner och tjänste-PMI upp"
      subtitle="Fortsatta tecken på avmattning i konjunkturen efter veckans industri-PMI. Tjänstesektorn återhämtade sig i april."
      footnote="Röda ringar markerar senaste värdet i tjänste-PMI-raderna, precis som referensbildens högra fokusmarkering."
    >
      <TimelineMacroMatrix
        matrix={matrix}
        rowHeader=""
        showQuarters={false}
        showDelta={false}
        valueDigits={2}
        highlightLatestKeys={HIGHLIGHT_SERVICE_PMI_KEYS}
      />
    </MacroMatrixSlide>
  );
}
