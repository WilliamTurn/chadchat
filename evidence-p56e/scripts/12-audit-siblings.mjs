// P56-E pre-delivery audit: sibling surfaces (READ-ONLY, Pro test account).
// /progress goal cards after the buildGoalVM extraction, /goals for the
// cross-surface number comparison, /meal-plan and /workouts render checks.
import { chromium, BASE, attachConsole } from './pw.mjs';

const STATE = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/scripts/state.json';
const OUT = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/audit';

async function run() {
  const browser = await chromium.launch();
  const results = {};
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: 'dark',
      storageState: STATE,
    });

    for (const [name, path] of [
      ['progress', '/progress'],
      ['goals', '/goals'],
      ['mealplan', '/meal-plan'],
      ['workouts', '/workouts'],
    ]) {
      const page = await ctx.newPage();
      const errs = [];
      attachConsole(page, errs);
      const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);
      const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 3500));
      results[name] = { status: resp.status(), url: page.url(), consoleErrors: errs, body };
      await page.screenshot({ path: `${OUT}/sibling-${name}-1440-dark.png`, fullPage: true });
      await page.close();
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 1));
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
