import { chromium, BASE, newCtx, attachConsole } from './pw.mjs';

const OUT = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/ours';
const PERSONAS = ['first-run', 'sparse', 'consistent', 'lapsed', 'overshoot', 'locked-basic'];
const URL = `${BASE}/dev/fixtures/plans-goals`;

const results = { sections: {}, console: [] };

async function shootPersona(page, id, tag) {
  // Section h2 text === persona id
  const section = page.locator('section', { has: page.locator('h2', { hasText: new RegExp(`^${id}$`) }) }).first();
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await section.screenshot({ path: `${OUT}/harness-${id}-${tag}.png` });
  const cardCount = await section.locator('.grid-dashboard > div').count();
  return cardCount;
}

async function run() {
  const browser = await chromium.launch();
  try {
    // Pass 1: 1440 dark, all six personas + card counts + text checks
    {
      const ctx = await newCtx(browser, { width: 1440, height: 1000, theme: 'dark' });
      const page = await ctx.newPage();
      attachConsole(page, results.console);
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      // full-page tall shot for reference
      await page.screenshot({ path: `${OUT}/harness-full-1440-dark.png`, fullPage: true });
      for (const id of PERSONAS) {
        results.sections[id] = { cards1440dark: await shootPersona(page, id, '1440-dark') };
      }
      // Text assertions
      const bodyText = await page.locator('body').innerText();
      results.checks = {
        consistent_day3legs: /Day 3:\s*Legs/i.test(bodyText),
        consistent_2of4: /2 of 4/i.test(bodyText),
        overshoot_day3done: /Day 3:\s*Legs/i.test(bodyText),
      };
      // Per-section targeted text
      const getSectionText = async (id) => {
        const s = page.locator('section', { has: page.locator('h2', { hasText: new RegExp(`^${id}$`) }) }).first();
        return (await s.innerText());
      };
      results.sectionText = {};
      for (const id of PERSONAS) results.sectionText[id] = await getSectionText(id);
      await ctx.close();
    }

    // Pass 2: consistent + locked-basic at 390 dark, 390 light, 1440 light
    for (const [w, theme, tag] of [[390, 'dark', '390-dark'], [390, 'light', '390-light'], [1440, 'light', '1440-light']]) {
      const ctx = await newCtx(browser, { width: w, height: 900, theme, touch: w === 390 });
      const page = await ctx.newPage();
      attachConsole(page, results.console);
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      for (const id of ['consistent', 'locked-basic']) {
        await shootPersona(page, id, tag);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
