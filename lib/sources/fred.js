function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export async function fetchFredSeries(seriesId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const response = await fetch(url, {
    headers: {
      'user-agent': 'stock-signals-data-foundation/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`FRED fetch failed for ${seriesId}: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/);
  const [headerLine, ...dataLines] = lines;
  const headers = parseCsvLine(headerLine);
  const dateIndex = headers.findIndex((header) => header.toUpperCase() === 'DATE');
  const valueIndex = headers.findIndex((header) => header.toUpperCase() === seriesId.toUpperCase());

  if (dateIndex === -1 || valueIndex === -1) {
    throw new Error(`Could not parse FRED CSV headers for ${seriesId}`);
  }

  return dataLines
    .map((line) => parseCsvLine(line))
    .map((cells) => ({
      series_id: seriesId,
      date: cells[dateIndex],
      value: cells[valueIndex],
    }))
    .filter((row) => row.date && row.value && row.value !== '.')
    .map((row) => ({ ...row, value: Number(row.value) }))
    .filter((row) => Number.isFinite(row.value));
}
