const fmt = (value, digits = 1, unit = '') =>
  value == null ? 'saknas' : Number(value).toLocaleString('sv-SE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + unit;
const signed = (value, digits = 1, unit = '') =>
  value == null ? 'saknas' : (value > 0 ? '+' : '') + fmt(value, digits, unit);
const names = {
  positive: 'Positiv', negative: 'Negativ', unknown: 'Saknas',
  improving: 'Förbättras', weakening: 'Försvagas', stable: 'Stabil',
  mixed: 'Blandat', stress_rising: 'Stress ökar', stress_easing: 'Stress avtar',
  accelerating: 'Inflationen accelererar', decelerating: 'Inflationen bromsar',
  oversold_watch: 'Extrem översåldhet – bevaka', recovery_watch: 'Tidiga återhämtningstecken – bevaka',
  none: 'Ingen separat köpbevakning',
  deteriorating: 'Försämrat marknadsläge', stabilizing: 'Möjlig stabilisering',
  early_warning: 'Varning i positiv lång trend', positive_trend: 'Positiv långsiktig trend',
  negative_trend: 'Negativ långsiktig trend'
};
const label = (s) => names[s] || 'Otillräckligt underlag';

function interpretation(s) {
  if (s.climate === 'deteriorating') return 'Börstrenden är negativ och marknadsbredden försämras. Ingen bekräftad återhämtning.';
  if (s.climate === 'stabilizing') return 'Bredden förbättras från svagt läge, men långtidstrenden är fortfarande negativ.';
  if (s.climate === 'early_warning') return 'Långtidstrenden är positiv men intern bredd eller kreditmarknad varnar.';
  if (s.climate === 'positive_trend') return 'Långtidstrenden är positiv. Bevaka om bredd och kredit fortsätter bekräfta.';
  if (s.climate === 'negative_trend') return 'Långtidstrenden är negativ. Enstaka positiva indikatorer är inte ett återinträde.';
  return 'Otillräcklig färsk marknadsdata för en sammanvägd lägesbeskrivning.';
}

export function formatRadarPlaintext(s) {
  return [
    'STOCK-SIGNALS | MARKET RADAR | ' + s.date,
    'Marknad: ' + label(s.climate) + ' – ' + interpretation(s),
    'Trend SPY SMA10: ' + label(s.trend.state) + ' (senast färdiga månad ' + (s.trend.spy.completedMonth ?? 'saknas') + ').',
    'Bredd över MA50: ' + fmt(s.breadth.pct50, 1, '%') + ' | förändring 5 handelsdagar ' + signed(s.breadth.delta5, 1, ' pp') + ' | ' + label(s.breadth.state) + '.',
    'Kredit HY OAS: ' + fmt(s.credit.value, 2, '%') + ' | förändring 20 sessioner ' + signed(s.credit.change20, 2, ' pp') + ' | ' + label(s.credit.state) + '.',
    'Makro, PROVISORISKT (arbetslöshet + Michigan): ' + label(s.macro.state) + '. Inflationsmomentum: ' + label(s.macro.inflation.state) + '.',
    'Extra-kapitalbevakning: ' + label(s.watch) + ' | SPY RSI(2) ' + fmt(s.trend.spy.rsi2, 1) + ' | DD252 ' + fmt(s.trend.spy.drawdown252, 1, '%') + '.',
    'Inga automatiska köp/sälj. PMI uteslutet på grund av periodiseringsrisk. Makro ej point-in-time-validerat.'
  ].join('\n');
}

export function buildDiscordRadarEmbed(s) {
  const fields = [
    { name: '📈 Långsiktig trend', value: [
      '**SPY SMA10:** ' + label(s.trend.state),
      'Månadsreferens: ' + (s.trend.spy.completedMonth ?? 'saknas'),
      'SPY från MA200: ' + signed(s.trend.spy.priceVs200, 1, '%'),
      'QQQ SMA10: ' + label(s.trend.qqq.trend)
    ].join('\n'), inline: true },
    { name: '📊 Marknadsbredd', value: [
      '**' + label(s.breadth.state) + '**',
      'Över MA20/50/200: ' + [s.breadth.pct20, s.breadth.pct50, s.breadth.pct200].map((v) => fmt(v, 0, '%')).join(' / '),
      'MA50-bredd, 5 dagar: ' + signed(s.breadth.delta5, 1, ' pp'),
      'Datadag: ' + (s.breadth.date ?? 'saknas')
    ].join('\n'), inline: true },
    { name: '🏦 Kreditstress', value: [
      '**' + label(s.credit.state) + '**',
      'HY OAS: ' + fmt(s.credit.value, 2, '%'),
      '20 sessioner: ' + signed(s.credit.change20, 2, ' pp'),
      'Datadag: ' + (s.credit.date ?? 'saknas')
    ].join('\n'), inline: true },
    { name: '🌍 Makro (preliminär, ej handelssignal)', value: [
      '**Tillväxtproxy:** ' + label(s.macro.state),
      'Arbetslöshet 3m: ' + signed(s.macro.jobs?.change3, 1, ' pp'),
      'Michigan 3m: ' + signed(s.macro.sentiment?.change3, 1, ' punkter'),
      'Inflation: ' + label(s.macro.inflation.state),
      'CPI 3m annualiserad: ' + fmt(s.macro.inflation.annualized3m, 1, '%')
    ].join('\n'), inline: false },
    { name: '🎯 Köpbevakning (extra kapital)', value: [
      '**' + label(s.watch) + '**',
      'RSI(2): ' + fmt(s.trend.spy.rsi2, 1) + ' · Nedgång från 252d topp: ' + fmt(s.trend.spy.drawdown252, 1, '%'),
      '5-dagars prisvändning: ' + (s.trend.spy.reversal5 ? 'ja' : 'nej'),
      'Ingen regel här är godkänd som automatisk köporder.'
    ].join('\n'), inline: false }
  ];
  const color = s.climate === 'positive_trend' ? 0x278f73 : s.climate === 'deteriorating' ? 0xc96b61 : 0x777f90;
  return {
    username: 'Stock Signals Radar',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: 'MARKET RADAR | ' + s.date,
      description: '**' + label(s.climate) + '**\n' + interpretation(s) +
        '\n\n*Fokus: förändring över tid – inte om varje datapunkt är bra eller dålig.*',
      color, fields,
      footer: { text: 'Researchpanel • Ingen handelsrekommendation • PMI exkluderat • Makro ej PIT-verifierat' },
      timestamp: s.date + 'T21:00:00.000Z'
    }]
  };
}

export function buildDiscordRadarAlert(s, event) {
  if (event.type === 'weekly_digest') {
    const change = event.breadthChange == null ? 'saknas' :
      (event.breadthChange > 0 ? '+' : '') + fmt(event.breadthChange, 1, ' pp');
    return {
      username: 'Stock Signals Radar',
      allowed_mentions: { parse: [] },
      embeds: [{
        title: '🗓️ MARKET RADAR | Veckosammanfattning',
        description: '**Marknad:** ' + label(event.from) + ' → ' + label(event.to) +
          '\n**MA50-bredd sedan ' + (event.beforeDate ?? '?') + ':** ' + change +
          '\n**Köpbevakning:** ' + label(s.watch) +
          '\n\nFörändringsöversikt, inte en fristående handelsstrategi.',
        color: 0x758698,
        footer: { text: 'Research • Källa: lagrade Neon-observationer • Inga automatiska order' }
      }]
    };
  }
  const domain = { long_trend: 'Långsiktig trend', breadth: 'Marknadsbredd',
    credit: 'Kreditstress', oversold_watch: 'Extra-kapitalbevakning' }[event.type] ?? event.type;
  return {
    username: 'Stock Signals Radar',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '⚠️ RADAR-FÖRÄNDRING | ' + domain,
      description: '**' + label(event.from) + ' → ' + label(event.to) + '**\n' +
        'Market Radar ' + s.date + '. Kontrollera fullständig status före tolkning.',
      color: event.type === 'oversold_watch' ? 0xd69d45 : 0x7b87b2,
      footer: { text: 'Researchnotis, inte köp- eller säljorder. Kredit och bredd kräver två observationer.' }
    }]
  };
}
