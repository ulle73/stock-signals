const DEFAULT_SLEEP_MS = 1200;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

export const GLOBAL_MANUFACTURING_PMI_DEFINITIONS = [
  { key: 'world', label: 'World', country: 'World', url: 'https://tradingeconomics.com/world/manufacturing-pmi', patterns: ['Manufacturing PMI in World[^<]{0,400}', 'Global Manufacturing PMI[^<]{0,400}'] },
  { key: 'united_states', label: 'US', country: 'United States', url: 'https://tradingeconomics.com/united-states/business-confidence', patterns: ['ISM Manufacturing PMI for the US[^<]{0,400}', 'United States ISM Manufacturing PMI[^<]{0,400}'] },
  { key: 'china', label: 'China', country: 'China', url: 'https://tradingeconomics.com/china/manufacturing-pmi', patterns: ['Manufacturing PMI in China[^<]{0,400}', 'China Manufacturing PMI[^<]{0,400}'] },
  { key: 'euro_area', label: 'EuroZone', country: 'Euro Area', url: 'https://tradingeconomics.com/euro-area/manufacturing-pmi', patterns: ['Manufacturing PMI in the Euro Area[^<]{0,400}', 'Manufacturing PMI in Euro Area[^<]{0,400}', 'Euro Area Manufacturing PMI[^<]{0,400}'] },
  { key: 'denmark', label: 'Denmark', country: 'Denmark', url: 'https://tradingeconomics.com/denmark/manufacturing-pmi', patterns: ['Manufacturing PMI in Denmark[^<]{0,400}', 'Denmark Manufacturing PMI[^<]{0,400}'] },
  { key: 'france', label: 'France', country: 'France', url: 'https://tradingeconomics.com/france/manufacturing-pmi', patterns: ['Manufacturing PMI in France[^<]{0,400}', 'France Manufacturing PMI[^<]{0,400}'] },
  { key: 'germany', label: 'Germany', country: 'Germany', url: 'https://tradingeconomics.com/germany/manufacturing-pmi', patterns: ['Manufacturing PMI in Germany[^<]{0,400}', 'Germany Manufacturing PMI[^<]{0,400}'] },
  { key: 'greece', label: 'Greece', country: 'Greece', url: 'https://tradingeconomics.com/greece/manufacturing-pmi', patterns: ['Manufacturing PMI in Greece[^<]{0,400}', 'Greece Manufacturing PMI[^<]{0,400}'] },
  { key: 'italy', label: 'Italy', country: 'Italy', url: 'https://tradingeconomics.com/italy/manufacturing-pmi', patterns: ['Manufacturing PMI in Italy[^<]{0,400}', 'Italy Manufacturing PMI[^<]{0,400}'] },
  { key: 'netherlands', label: 'Netherlands', country: 'Netherlands', url: 'https://tradingeconomics.com/netherlands/manufacturing-pmi', patterns: ['Manufacturing PMI in Netherlands[^<]{0,400}', 'Netherlands Manufacturing PMI[^<]{0,400}'] },
  { key: 'spain', label: 'Spain', country: 'Spain', url: 'https://tradingeconomics.com/spain/manufacturing-pmi', patterns: ['Manufacturing PMI in Spain[^<]{0,400}', 'Spain Manufacturing PMI[^<]{0,400}'] },
  { key: 'sweden', label: 'Sweden', country: 'Sweden', url: 'https://tradingeconomics.com/sweden/manufacturing-pmi', patterns: ['Manufacturing PMI in Sweden[^<]{0,400}', 'Sweden Manufacturing PMI[^<]{0,400}'] },
  { key: 'switzerland', label: 'Switzerland', country: 'Switzerland', url: 'https://tradingeconomics.com/switzerland/manufacturing-pmi', patterns: ['Manufacturing PMI in Switzerland[^<]{0,400}', 'Switzerland Manufacturing PMI[^<]{0,400}'] },
  { key: 'india', label: 'India', country: 'India', url: 'https://tradingeconomics.com/india/manufacturing-pmi', patterns: ['Manufacturing PMI in India[^<]{0,400}', 'India Manufacturing PMI[^<]{0,400}'] },
  { key: 'indonesia', label: 'Indonesia', country: 'Indonesia', url: 'https://tradingeconomics.com/indonesia/manufacturing-pmi', patterns: ['Manufacturing PMI in Indonesia[^<]{0,400}', 'Indonesia Manufacturing PMI[^<]{0,400}'] },
  { key: 'japan', label: 'Japan', country: 'Japan', url: 'https://tradingeconomics.com/japan/manufacturing-pmi', patterns: ['Manufacturing PMI in Japan[^<]{0,400}', 'Japan Manufacturing PMI[^<]{0,400}'] },
  { key: 'malaysia', label: 'Malaysia', country: 'Malaysia', url: 'https://tradingeconomics.com/malaysia/manufacturing-pmi', patterns: ['Manufacturing PMI in Malaysia[^<]{0,400}', 'Malaysia Manufacturing PMI[^<]{0,400}'] },
  { key: 'philippines', label: 'Philippines', country: 'Philippines', url: 'https://tradingeconomics.com/philippines/manufacturing-pmi', patterns: ['Manufacturing PMI in Philippines[^<]{0,400}', 'Philippines Manufacturing PMI[^<]{0,400}'] },
  { key: 'taiwan', label: 'Taiwan', country: 'Taiwan', url: 'https://tradingeconomics.com/taiwan/manufacturing-pmi', patterns: ['Manufacturing PMI in Taiwan[^<]{0,400}', 'Taiwan Manufacturing PMI[^<]{0,400}'] },
  { key: 'thailand', label: 'Thailand', country: 'Thailand', url: 'https://tradingeconomics.com/thailand/manufacturing-pmi', patterns: ['Manufacturing PMI in Thailand[^<]{0,400}', 'Thailand Manufacturing PMI[^<]{0,400}'] },
  { key: 'vietnam', label: 'Vietnam', country: 'Vietnam', url: 'https://tradingeconomics.com/vietnam/manufacturing-pmi', patterns: ['Manufacturing PMI in Vietnam[^<]{0,400}', 'Vietnam Manufacturing PMI[^<]{0,400}'] },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ');
}

function extractFirstPmiValue(snippet) {
  const match = snippet.match(/\b([0-9]{2}\.[0-9]+)\b/);
  return match ? Number(match[1]) : null;
}

function extractValueFromHtml(html, definition) {
  const text = normalizeWhitespace(html);

  for (const pattern of definition.patterns) {
    const match = text.match(new RegExp(pattern, 'i'));
    if (!match) continue;

    const value = extractFirstPmiValue(match[0]);
    if (value !== null) {
      return { value, snippet: match[0] };
    }
  }

  return { value: null, snippet: null };
}

export function getTradingEconomicsPmiSleepMs() {
  const parsed = Number(process.env.TRADING_ECONOMICS_PMI_SLEEP_MS ?? DEFAULT_SLEEP_MS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SLEEP_MS;
}

export async function fetchTradingEconomicsManufacturingPmi(definition, { fetchImpl = fetch } = {}) {
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
    throw new Error(`Could not parse Manufacturing PMI value for ${definition.label}`);
  }

  return {
    ...definition,
    value,
    sourceUrl: definition.url,
    sourceSnippet: snippet,
    observedAt: new Date().toISOString(),
  };
}

export async function fetchGlobalManufacturingPmiValues({ sleepMs = getTradingEconomicsPmiSleepMs(), fetchImpl = fetch } = {}) {
  const rows = [];
  const failures = [];

  for (let index = 0; index < GLOBAL_MANUFACTURING_PMI_DEFINITIONS.length; index += 1) {
    const definition = GLOBAL_MANUFACTURING_PMI_DEFINITIONS[index];

    try {
      const row = await fetchTradingEconomicsManufacturingPmi(definition, { fetchImpl });
      rows.push(row);
    } catch (error) {
      failures.push({ key: definition.key, label: definition.label, url: definition.url, error: error.message });
    }

    if (sleepMs > 0 && index < GLOBAL_MANUFACTURING_PMI_DEFINITIONS.length - 1) {
      await sleep(sleepMs);
    }
  }

  return { rows, failures };
}
