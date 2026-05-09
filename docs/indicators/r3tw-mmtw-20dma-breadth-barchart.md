# Indicator: R3TW + MMTW 20DMA Breadth Buy via Barchart

## Status

Status: implemented
Implemented commit: uncommitted
Barchart R3TW data verification: partial
Barchart MMTW data verification: partial
TradingView verification: pending

## Purpose

This indicator recreates the TradingView breadth buy signal using:

```text
INDEX:R3TW
INDEX:MMTW
```

The signal triggers when both breadth series cross above 20 on the same daily bar.

Likely category/timeframe:

```text
category: breadth / momentum breadth
timeframe: short_to_medium_term
future telegram channel: breadth-signals or momentum-signals
```

Do not implement Telegram routing yet.

## Data source

### R3TW

TradingView source:

```text
INDEX:R3TW
```

Barchart replacement source:

```text
https://www.barchart.com/stocks/quotes/%24R3TW
```

User-tested Playwright scrape found:

```text
Russell 3000 Stocks Above 20-Day Average ($R3TW)
Last Price      53.52
```

Mapping:

```text
INDEX:R3TW close ≈ Barchart $R3TW Last Price
```

### MMTW

TradingView source:

```text
INDEX:MMTW
```

Barchart replacement source:

```text
https://www.barchart.com/stocks/quotes/%24MMTW
```

User-tested Playwright scrape found:

```text
Last Price      53.72
```

Mapping:

```text
INDEX:MMTW close ≈ Barchart $MMTW Last Price
```

Note: the user test confirmed that the page returns a Last Price for `$MMTW`, but the current line filter did not include a specific MMTW name/title. Implementation should parse the Last Price from the configured URL/symbol, not rely on finding the full descriptive title text.

## Data pipeline note

This indicator requires external Barchart breadth data.

Do not rewrite the existing Yahoo/FRED/S&P 500 fetch pipeline.

Implement the smallest possible separate Barchart breadth fetch/storage path.

Recommended approach:

```text
lib/sources/barchart-breadth.js
lib/repositories/barchart-breadth.js
scripts/fetch-barchart-breadth.js
```

The existing `fetch:daily` pipeline should remain untouched unless explicitly approved.

If historical daily values are not available from the public page, start by storing the daily latest value when the script runs after market close. Later, historical backfill can be added if a reliable source is found.

## Suggested database table

Because these are external daily breadth series, prefer a dedicated table:

```text
external_breadth_daily
```

Recommended columns:

```text
id
date
series_key
symbol
name
value
source
source_url
created_at
updated_at
unique(date, series_key)
```

Example rows:

```text
series_key = R3TW
symbol = $R3TW
name = Russell 3000 Stocks Above 20-Day Average
value = Last Price from Barchart
source = barchart

series_key = MMTW
symbol = $MMTW
name = MMTW
value = Last Price from Barchart
source = barchart
```

## Original TradingView/Pine Script code

```pinescript
// Function to request security data
getSecurityData(symbol, timeframe, src) =>
    request.security(symbol, timeframe, src)

// Get INDEX:R3TW and INDEX:MMTW data
r3twData = getSecurityData("INDEX:R3TW", "D", close)
mmtwData = getSecurityData("INDEX:MMTW", "D", close)

// Condition for both tickers crossing above 20
buySignalCondition = ta.crossover(r3twData, 20) and ta.crossover(mmtwData, 20)

// Plotting buy signal
plotshape(series=buySignalCondition, title="Buy Signal", color=color.rgb(0, 100, 131), style=shape.triangleup, size=size.tiny, location=location.belowbar)
```

## Exact rules to implement

### Source replacement

Replace:

```text
INDEX:R3TW close
INDEX:MMTW close
```

with:

```text
Barchart $R3TW Last Price
Barchart $MMTW Last Price
```

### Signal rule

TradingView rule:

```pinescript
ta.crossover(r3twData, 20) and ta.crossover(mmtwData, 20)
```

Repo implementation:

```text
previous R3TW <= 20 AND current R3TW > 20
AND
previous MMTW <= 20 AND current MMTW > 20
```

This is a raw breadth buy signal.

Do not route it to Telegram yet.

## Suggested derived fields

Use names like:

```text
r3tw_value
mmtw_value
r3tw_cross_up_20
mmtw_cross_up_20
r3tw_mmtw_buy_signal
r3tw_mmtw_signal
```

Recommended `r3tw_mmtw_signal` values:

```text
none
buy_both_cross_above_20
```

## User-tested R3TW scrape

The user tested this Playwright script:

```js
const { chromium } = require("playwright");

const URL = "https://www.barchart.com/stocks/quotes/%24R3TW";

async function main() {
  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  await page.goto(URL, {
    waitUntil: "networkidle",
    timeout: 60000,
  });

  await page.waitForTimeout(5000);

  const text = await page.locator("body").innerText();

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const interesting = lines.filter((line) =>
    /R3TW|Russell 3000 Stocks Above 20-Day Average|Last Price|Latest|Price/i.test(
      line,
    ),
  );

  console.log("\n--- MATCHING LINES ---");
  console.log(interesting.join("\n"));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Observed output:

```text
Russell 3000 Stocks Above 20-Day Average ($R3TW)
Last Price      53.52
```

## User-tested MMTW scrape

The user tested the same Playwright approach with:

```js
const URL = "https://www.barchart.com/stocks/quotes/%24MMTW";
```

Observed output:

```text
Last Price      53.72
```

The filter used in the test still looked for `R3TW|Russell 3000...|Last Price|Latest|Price`, so it captured the Last Price but not necessarily the MMTW title. That is acceptable for now because the configured URL determines the symbol.

## Codex task prompt

```text
Implement the indicator/data intake described in docs/indicators/r3tw-mmtw-20dma-breadth-barchart.md.

Important:
- This replaces TradingView INDEX:R3TW and INDEX:MMTW using Barchart breadth pages.
- Use Barchart $R3TW Last Price as R3TW value.
- Use Barchart $MMTW Last Price as MMTW value.
- Parse Last Price from the configured Barchart URL for each symbol.
- Do not rely on finding a full descriptive title for each page.
- Add the smallest possible separate Barchart data fetch/storage path.
- Do not rewrite the existing Yahoo/FRED/S&P 500 fetch pipeline.
- Do not add Telegram behavior yet.
- Do not add backtest logic unless explicitly requested.

Implement:
1. Barchart source scraper/parser for configured breadth symbols.
2. Database migration for external breadth daily rows or approved generic external daily series table.
3. Repository upsert function with unique(date, series_key).
4. Script to fetch $R3TW and $MMTW after market close.
5. Raw crossover signal: both R3TW and MMTW cross above 20 on the same daily row.
6. Tests for:
   - parsing Last Price from stored/snapshotted page text
   - saving R3TW and MMTW values
   - detecting crossover above 20
   - requiring both crossovers on the same date

When done:
1. Update this doc's status to implemented.
2. Add the implementation commit hash.
3. Ask the user to verify at least one date/value against Barchart and one signal date/value against TradingView.
```

## Manual Barchart verification

```text
Date:
R3TW Barchart URL: https://www.barchart.com/stocks/quotes/%24R3TW
R3TW Barchart Last Price:
Repo R3TW value:

MMTW Barchart URL: https://www.barchart.com/stocks/quotes/%24MMTW
MMTW Barchart Last Price:
Repo MMTW value:

Result:
```

## Manual TradingView verification

```text
TradingView sources: INDEX:R3TW, INDEX:MMTW
Date:
TradingView R3TW close:
Repo R3TW value:
TradingView MMTW close:
Repo MMTW value:
TradingView buy signal:
Repo buy signal:
Result:
```

Do not mark this indicator as `user_verified` until the user confirms the comparison.
