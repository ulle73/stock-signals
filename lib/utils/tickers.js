export function toYahooTicker(ticker) {
  return String(ticker || '').trim().replaceAll('.', '-');
}

export function cleanTicker(ticker) {
  return String(ticker || '').trim();
}
