import { chromium, BASE, newCtx, attachConsole } from './pw.mjs';

const OUT = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/ours';
const PERSONAS = ['first-run', 'sparse', 'consistent', 'lapsed', 'overshoot', 'locked-basic'];
const URL = `${BASE}/dev/fixtures/plans-goals`;
const results = { console: [], sectionText: {}, cardCounts: {} };

async function sect(page, id) {
  return page.locator('section', { has: page.locator('h2', { hasText: new RegExp(`^${id}$`) }) }).first();
}

async function run() {
  const browser = await chromium.launch();
  try {
    // Data + 1440 light missing shots
    const ctx = await newCtx(browser, { width: 1440, height: 1000, theme: 'dark' });
    const page = await ctx.newPage();
    attachConsole(page, results.console);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    for (const id of PERSONAS) {
      const s = await sect(page, id);
      results.cardCounts[id] = await s.locator('.grid-dashboard > div').count();
      results.sectionText[id] = await s.innerText();
    }
    await ctx.close();

    // 1440 light for consistent + locked-basic
    const ctx2 = await newCtx(browser, { width: 1440, height: 1000, theme: 'light' });
    const page2 = await ctx2.newPage();
    attachConsole(page2, results.console);
    await page2.goto(URL, { waitUntil: 'networkidle' });
    await page2.evaluate(() => document.fonts.ready);
    await page2.waitForTimeout(300);
    for (const id of ['consistent', 'locked-basic']) {
      const s = await sect(page2, id);
      await s.scrollIntoViewIfNeeded();
      await page2.waitForTimeout(150);
      await s.screenshot({ path: `${OUT}/harness-${id}-1440-light.png`, timeout: 15000 });
    }
    await ctx2.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
