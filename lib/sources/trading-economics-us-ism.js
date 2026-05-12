const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const SOURCE_URL = 'https://tradingeconomics.com/united-states/business-confidence';

export const US_ISM_INDICATOR_DEFINITIONS = [
  {
    key: 'ism_manufacturing_index_candidate',
    label: 'ISM Manufacturing Index',
    patterns: [
      /ISM Manufacturing PMI for the US[^<]*?([0-9]{2}(?:\.[0-9]+)?)/i,
      /Business Confidence in the United States[^<]*?([0-9]{2}(?:\.[0-9]+)?)/i,
    ],
  },
  {
    key: 'ism_manufacturing_new_orders_candidate',
    label: 'ISM Manufacturing New Orders',
    patterns: [
      /New orders[^<]*?\(([0-9]{2}(?:\.[0-9]+)?)\s+v/i,
      /new orders[^<]*?([0-9]{2}(?:\.[0-9]+)?)/i,
    ],
  },
  {
    key: 'ism_manufacturing_production_candidate',
    label: 'ISM Manufacturing Production',
    patterns: [
      /Production[^<]*?\(([0-9]{2}(?:\.[0-9]+)?)\s+v/i,
      /production[^<]*?([0-9]{2}(?:\.[0-9]+)?)/i,
    ],
  },
];

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ');
}

function extractValue(text, definition) {
  for (const pattern of definition.patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      return {
        value,
        sourceSnippet: match[0],
      };
    }
  }

  return { value: null, sourceSnippet: null };
}

export async function fetchUsIsmIndicators({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(SOURCE_URL, {
    headers: {
      'user-agent': process.env.TRADING_ECONOMICS_USER_AGENT ?? DEFAULT_USER_AGENT,
      'accept-language': 'en-US,en;q=0.9',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Trading Economics returned ${response.status} for US ISM indicators`);
  }

  const text = normalizeWhitespace(await response.text());
  const rows = [];
  const failures = [];

  for (const definition of US_ISM_INDICATOR_DEFINITIONS) {
    const parsed = extractValue(text, definition);

    if (parsed.value === null) {
      failures.push({ key: definition.key, label: definition.label, error: 'Could not parse value from Trading Economics page' });
      continue;
    }

    rows.push({
      key: definition.key,
      label: definition.label,
      value: parsed.value,
      sourceUrl: SOURCE_URL,
      sourceSnippet: parsed.sourceSnippet,
      observedAt: new Date().toISOString(),
    });
  }

  return { rows, failures };
}
