const DEFAULT_SLEEP_MS = 1200;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

export const EUROPE_GROWTH_INDICATOR_DEFINITIONS = [
  {
    key: 'industrial_confidence_eurozone',
    label: 'Industrial Confidence Indicator: EuroZone',
    url: 'https://tradingeconomics.com/euro-area/industrial-confidence-indicator-eurostat-data.html',
    patterns: ['Euro Area - Industrial confidence indicator was -?[0-9]+(\\.[0-9]+)?'],
    direction: 'higher_is_better',
  },
  {
    key: 'consumer_confidence_eurozone',
    label: 'Consumer Confidence Indicator: EuroZone',
    url: 'https://tradingeconomics.com/euro-area/consumer-confidence',
    patterns: ['Consumer Confidence [Ii]n the Euro Area[^<]{0,400}'],
    direction: 'higher_is_better',
  },
  {
    key: 'economic_sentiment_eurozone',
    label: 'Economic Sentiment Indicator: EuroZone',
    url: 'https://tradingeconomics.com/euro-area/economic-sentiment-indicator-eurostat-data.html',
    patterns: ['Euro Area - Economic sentiment indicator was -?[0-9]+(\\.[0-9]+)?'],
    direction: 'higher_is_better',
  },
  {
    key: 'ifo_business_climate_germany',
    label: 'IFO Business Climate: Germany',
    url: 'https://tradingeconomics.com/germany/business-confidence',
    patterns: ['Business Confidence in Germany[^<]{0,400}'],
    direction: 'higher_is_better',
  },
  {
    key: 'zew_eurozone',
    label: 'ZEW Index: Euro Zone',
    url: 'https://tradingeconomics.com/euro-area/zew-economic-sentiment-index',
    patterns: ['ZEW Economic Sentiment Index In the Euro Area[^<]{0,400}'],
    direction: 'higher_is_better',
  },
  {
    key: 'zew_germany',
    label: 'ZEW Index: Germany',
    url: 'https://tradingeconomics.com/germany/zew-economic-sentiment-index',
    patterns: ['ZEW Economic Sentiment Index in Germany[^<]{0,400}'],
    direction: 'higher_is_better',
  },
  {
    key: 'manufacturing_pmi_eurozone',
    label: 'Manufacturing PMI: EuroZone',
    url: 'https://tradingeconomics.com/euro-area/manufacturing-pmi',
    patterns: ['Manufacturing PMI In the Euro Area[^<]{0,400}', 'Manufacturing PMI in the Euro Area[^<]{0,400}'],
    direction: 'pmi',
  },
  {
    key: 'services_pmi_eurozone',
    label: 'Services PMI: EuroZone',
    url: 'https://tradingeconomics.com/euro-area/services-pmi',
    patterns: ['Services PMI In the Euro Area[^<]{0,400}', 'Services PMI in the Euro Area[^<]{0,400}'],
    direction: 'pmi',
  },
  {
    key: 'retail_sales_yoy_eurozone',
    label: 'Retail Sales YoY: EuroZone',
    url: 'https://tradingeconomics.com/euro-area/retail-sales-annual',
    patterns: ['Retail Sales In the Euro Area[^<]{0,400}', 'Retail Sales in the Euro Area[^<]{0,400}'],
    direction: 'higher_is_better',
  },
  {
    key: 'car_registrations_eurozone',
    label: 'New Passenger Car Registrations: EuroZone',
    url: 'https://tradingeconomics.com/euro-area/car-registrations',
    patterns: ['Car Registrations In the Euro Area[^<]{0,400}', 'Car Registrations in the Euro Area[^<]{0,400}'],
    direction: 'higher_is_better',
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ');
}

function extractFirstNumber(snippet) {
  const match = snippet.match(/-?[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : null;
}

function extractValueFromHtml(html, definition) {
  const text = normalizeWhitespace(html);

  for (const pattern of definition.patterns) {
    const match = text.match(new RegExp(pattern, 'i'));
    if (!match) continue;

    const value = extractFirstNumber(match[0]);
    if (value !== null) {
      return { value, snippet: match[0] };
    }
  }

  return { value: null, snippet: null };
}

export function getEuropeGrowthSleepMs() {
  const parsed = Number(process.env.EUROPE_GROWTH_SLEEP_MS ?? DEFAULT_SLEEP_MS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SLEEP_MS;
}

export async function fetchEuropeGrowthIndicator(definition, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(definition.url, {
    headers: {
      'user-agent': process.env.TRADING_ECONOMICS_USER_AGENT ?? DEFAULT_USER_AGENT,
      'accept-language': 'en-US,en;q=0.9',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Trading Economics returned ${response.status} for ${definition.label}`);
  }

  const html = await response.text();
  const { value, snippet } = extractValueFromHtml(html, definition);

  if (value === null) {
    throw new Error(`Could not parse Europe growth value for ${definition.label}`);
  }

  return {
    ...definition,
    value,
    sourceUrl: definition.url,
    sourceSnippet: snippet,
    observedAt: new Date().toISOString(),
  };
}

export async function fetchEuropeGrowthValues({ sleepMs = getEuropeGrowthSleepMs(), fetchImpl = fetch } = {}) {
  const rows = [];
  const failures = [];

  for (let index = 0; index < EUROPE_GROWTH_INDICATOR_DEFINITIONS.length; index += 1) {
    const definition = EUROPE_GROWTH_INDICATOR_DEFINITIONS[index];

    try {
      rows.push(await fetchEuropeGrowthIndicator(definition, { fetchImpl }));
    } catch (error) {
      failures.push({ key: definition.key, label: definition.label, url: definition.url, error: error.message });
    }

    if (sleepMs > 0 && index < EUROPE_GROWTH_INDICATOR_DEFINITIONS.length - 1) {
      await sleep(sleepMs);
    }
  }

  return { rows, failures };
}
