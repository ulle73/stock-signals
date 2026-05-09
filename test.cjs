// test-r3tw-barchart.js
const { chromium } = require("playwright");

// const URL = "https://www.barchart.com/stocks/quotes/%24R3TW";
const URL = "https://www.barchart.com/stocks/quotes/%24MMTW";

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

  console.log("\n--- FIRST 100 LINES ---");
  console.log(lines.slice(0, 100).join("\n"));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
