import DashboardTopNav from '../dashboard-top-nav.js';
import { getChartTickerOptions } from '../../lib/repositories/chart-ticker-options.js';
import {
  normalizeChartPeriod,
  normalizeChartTicker,
} from '../../lib/chart/chart-periods.js';
import ChartWorkspace from './chart-workspace.js';

export const dynamic = 'force-dynamic';

function resolveTicker(value, tickerOptions) {
  const requested = normalizeChartTicker(value);
  if (requested && tickerOptions.some((item) => item.ticker === requested)) return requested;
  return tickerOptions.find((item) => item.ticker === 'AAPL')?.ticker
    ?? tickerOptions[0]?.ticker
    ?? 'AAPL';
}

export default async function ChartPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const tickerOptions = await getChartTickerOptions();
  const initialTicker = resolveTicker(resolvedSearchParams?.ticker, tickerOptions);
  const initialPeriod = normalizeChartPeriod(resolvedSearchParams?.period);

  return (
    <main className="page-shell restyle-page chart-page-shell">
      <DashboardTopNav activeItem="Chart" updatedLabel="Daglig chartdata" />
      <ChartWorkspace
        constituents={tickerOptions}
        initialTicker={initialTicker}
        initialPeriod={initialPeriod}
      />
    </main>
  );
}
