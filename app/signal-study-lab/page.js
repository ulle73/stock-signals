import fs from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getActiveConstituents } from '../../lib/repositories/constituents.js';
import {
  listSignalStudyFieldsWithAvailability,
  listSignalStudyReturnInstruments,
} from '../../lib/repositories/signal-studies.js';
import { listSignalStudyFields } from '../../lib/signal-registry/fields.js';
import { isSignalStudyLabEnabled } from '../../lib/utils/signal-study-feature.js';
import SignalStudyLabClient from './signal-study-lab-client.js';

export const dynamic = 'force-dynamic';

async function loadExample(filename, label, description) {
  const fullPath = path.join(process.cwd(), 'studies', 'examples', filename);
  const raw = await fs.readFile(fullPath, 'utf8');
  return {
    id: filename.replace('.json', ''),
    filename,
    label,
    description,
    config: JSON.parse(raw),
  };
}

function buildReturnInstrumentOptions(items, constituents) {
  const constituentMap = new Map(
    constituents.map((item) => [item.ticker, item.company_name])
  );

  return items.map((item) => ({
    value: item.instrument,
    label: constituentMap.has(item.instrument)
      ? `${item.instrument} · ${constituentMap.get(item.instrument)}`
      : item.instrument,
    primarySourceTable: item.primarySourceTable,
  }));
}

function buildSignalInstrumentOptions(constituents) {
  return constituents.map((item) => ({
    value: item.ticker,
    label: `${item.ticker} · ${item.company_name}`,
  }));
}

export default async function SignalStudyLabPage() {
  if (!isSignalStudyLabEnabled()) {
    notFound();
  }

  const baseFields = listSignalStudyFields();
  const [fields, returnInstruments, constituents, examples] = await Promise.all([
    listSignalStudyFieldsWithAvailability(baseFields),
    listSignalStudyReturnInstruments(),
    getActiveConstituents(),
    Promise.all([
      loadExample(
        'breadth-cross-forward.json',
        'Breadth cross över 50',
        'En enkel forward study som redan ger sample count i nuvarande data.'
      ),
      loadExample(
        'tf-sync-forward.json',
        'TF Sync + position + breadth',
        'Visar hur flera samtidiga villkor byggs i forward horizon-läge.'
      ),
      loadExample(
        'tf-sync-green-period.json',
        'TF Sync green period',
        'Visar state period-läge med entry/exit-delays, max hold och neutralt avslut.'
      ),
    ]),
  ]);

  const returnInstrumentOptions = buildReturnInstrumentOptions(returnInstruments, constituents);
  const signalInstrumentOptions = buildSignalInstrumentOptions(constituents);

  return (
    <main className="page-shell study-lab-shell">
      <section className="signal-hero study-lab-hero">
        <div>
          <p className="eyebrow">Signal Study Lab</p>
          <div className="signal-headline">
            <div>
              <h1>Bygg event studies utan hårdkodade tester.</h1>
              <p className="hero-copy">
                Välj signaler, filter, operators, state-logik och valfritt return-instrument.
                Samma registry driver både UI, API och JSON-runnern.
              </p>
            </div>
          </div>
        </div>
        <div className="thermometer-card study-lab-aside">
          <p className="panel-label">Öppna från dashboarden</p>
          <strong>/signal-study-lab</strong>
          <p className="footnote">
            Kör forward horizon och state period-studier mot samma datalager som resten av projektet.
          </p>
          <Link className="study-lab-link-button" href="/">
            Tillbaka till dashboard
          </Link>
        </div>
      </section>

      <SignalStudyLabClient
        examples={examples}
        fields={fields}
        returnInstrumentOptions={returnInstrumentOptions}
        signalInstrumentOptions={signalInstrumentOptions}
        storageKind="database"
      />
    </main>
  );
}
