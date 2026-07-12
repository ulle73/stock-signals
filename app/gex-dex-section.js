import { getGexDexStrikeSnapshots } from '../lib/repositories/gex-dex-snapshots.js';
import { getLatestGexDexDashboardRows } from '../lib/repositories/gex-dex-signals.js';
import { buildGexDexDashboardView } from '../lib/utils/gex-dex-dashboard-view.js';
import { GexDexSectionView } from './gex-dex-section-view.js';

export default async function GexDexSection() {
  const rows = await getLatestGexDexDashboardRows();
  const strikes = await getGexDexStrikeSnapshots(rows.map((row) => row.id));
  const viewModel = buildGexDexDashboardView(rows, strikes);

  return <GexDexSectionView viewModel={viewModel} />;
}
