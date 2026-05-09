const FINRA_BASE_URL = 'https://cdn.finra.org/equity/regsho/daily';

function toNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toIsoDate(compactDate) {
  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

export function buildFinraShortVolumeUrl(date) {
  const compactDate = date.replaceAll('-', '');
  return `${FINRA_BASE_URL}/CNMSshvol${compactDate}.txt`;
}

export function parseFinraShortVolumeFile(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const expectedHeader = 'Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market';

  if (headerLine.trim() !== expectedHeader) {
    throw new Error('Could not parse FINRA short-volume file header');
  }

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|'))
    .filter((cells) => cells.length >= 6 && /^\d{8}$/.test(cells[0]))
    .map((cells) => ({
      date: toIsoDate(cells[0]),
      symbol: cells[1],
      short_volume: toNumeric(cells[2]),
      short_exempt_volume: toNumeric(cells[3]),
      total_volume: toNumeric(cells[4]),
      market: cells[5],
    }));
}

export function selectFinraShortVolumeRow(rows, symbol) {
  return rows.find((row) => row.symbol === symbol) ?? null;
}

export async function fetchFinraShortVolumeRow(date, symbol = 'PLCE', fetchFn = fetch) {
  const url = buildFinraShortVolumeUrl(date);
  const response = await fetchFn(url, {
    headers: {
      'user-agent': 'stock-signals-indicators/0.1',
      accept: 'text/plain',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`FINRA fetch failed for ${date}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const rows = parseFinraShortVolumeFile(text);
  const row = selectFinraShortVolumeRow(rows, symbol);

  if (!row) {
    return null;
  }

  return {
    ...row,
    source: 'finra',
    source_url: url,
  };
}
