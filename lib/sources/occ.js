const OCC_BASE_URL = 'https://marketdata.theocc.com/mdapi/daily-volume-totals';

function toNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function buildOccDailyVolumeUrl(reportDate) {
  return `${OCC_BASE_URL}?report_date=${encodeURIComponent(reportDate)}`;
}

export function parseOccDailyVolumePayload(reportDate, payload) {
  const totalVolumeRows = payload?.entity?.total_volume;

  if (!Array.isArray(totalVolumeRows)) {
    throw new Error(`Could not parse OCC daily volume totals for ${reportDate}`);
  }

  return totalVolumeRows
    .filter((row) => row.exchange)
    .map((row) => ({
      report_date: reportDate,
      exchange: row.exchange,
      calls: toNumeric(row.calls),
      puts: toNumeric(row.puts),
      ratio: toNumeric(row.ratio),
      volume: toNumeric(row.volume),
      market_share: toNumeric(row.market_share),
      source: 'occ',
      source_url: buildOccDailyVolumeUrl(reportDate),
    }));
}

export async function fetchOccDailyVolumeTotals(reportDate, fetchFn = fetch) {
  const url = buildOccDailyVolumeUrl(reportDate);
  const response = await fetchFn(url, {
    headers: {
      'user-agent': 'stock-signals-indicators/0.1',
      accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`OCC fetch failed for ${reportDate}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return parseOccDailyVolumePayload(reportDate, payload);
}
