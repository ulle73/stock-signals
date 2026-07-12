import DashboardTopNav from '../dashboard-top-nav.js';
import { getActiveConstituents } from '../../lib/repositories/constituents.js';
import {
  normalizeChartPeriod,
  normalizeChartTicker,
} from '../../lib/chart/chart-periods.js';
import ChartWorkspace from './chart-workspace.js';

export const dynamic = 'force-dynamic';

function resolveTicker(value, constituents) {
  const requested = normalizeChartTicker(value);
  if (requested && constituents.some((item) => item.ticker === requested)) return requested;
  return constituents.find((item) => item.ticker === 'AAPL')?.ticker
    ?? constituents[0]?.ticker
    ?? 'AAPL';
}

export default async function ChartPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const constituents = await getActiveConstituents();
  const initialTicker = resolveTicker(resolvedSearchParams?.ticker, constituents);
  const initialPeriod = normalizeChartPeriod(resolvedSearchParams?.period);

  return (
    <main className="page-shell restyle-page chart-page-shell">
      <DashboardTopNav activeItem="Chart" updatedLabel="Daglig chartdata" />
      <ChartWorkspace
        constituents={constituents}
        initialTicker={initialTicker}
        initialPeriod={initialPeriod}
      />
    </main>
  );
}
