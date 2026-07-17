import { buildChartTickerOptions } from '../chart/chart-ticker-options.js';
import { getActiveConstituents } from './constituents.js';
import { getTopVolumeGexDexTickers } from './gex-dex-universe.js';

export async function getChartTickerOptions({
  getConstituentsFn = getActiveConstituents,
  getFeaturedTickersFn = getTopVolumeGexDexTickers,
} = {}) {
  const [constituents, featuredTickers] = await Promise.all([
    getConstituentsFn(),
    getFeaturedTickersFn(),
  ]);

  return buildChartTickerOptions({ constituents, featuredTickers });
}
