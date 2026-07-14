// P56-E pre-delivery audit: adversarial harness probes (no auth needed).
// first-run fake zeros, locked-basic data leaks, lapsed staleness framing,
// 320px overflow, plus the today-panels sibling harness.
import { chromium, BASE, attachConsole, applyTheme } from './pw.mjs';

const OUT = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/audit';

async function sectionTexts(page) {
  return await page.evaluate(() => {
    const out = {};
    for (const sec of document.querySelectorAll('section')) {
      const h2 = sec.querySelector('h2');
      if (!h2) continue;
      const id = h2.textContent.trim();
      const cards = [];
      for (const card of sec.querySelectorAll('[data-panel-role]')) {
        cards.push({
          role: card.getAttribute('data-panel-role'),
          state: card.getAttribute('data-panel-state'),
          text: card.innerText.replace(/\s+/g, ' ').trim(),
        });
      }
      if (cards.length) out[id] = cards;
    }
    return out;
  });
}

async function run() {
  const browser = await chromium.launch();
  const results = {};
  try {
    // 1440 pass
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
    const page = await ctx.newPage();
    const errs = [];
    attachConsole(page, errs);
    await page.goto(`${BASE}/dev/fixtures/plans-goals`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1000);
    await applyTheme(page, 'dark');
    results.sections = await sectionTexts(page);
    results.consoleErrors = errs;

    // 320px overflow probe
    const ctx320 = await browser.newContext({
      viewport: { width: 320, height: 900 },
      colorScheme: 'dark', hasTouch: true, isMobile: true, deviceScaleFactor: 2,
    });
    const p320 = await ctx320.newPage();
    const errs320 = [];
    attachConsole(p320, errs320);
    await p320.goto(`${BASE}/dev/fixtures/plans-goals`, { waitUntil: 'networkidle', timeout: 60000 });
    await p320.waitForTimeout(1000);
    results.overflow320 = await p320.evaluate(() => {
      const doc = document.scrollingElement.scrollWidth - window.innerWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('[data-panel-role] *')) {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 1 || r.left < -1) {
          offenders.push({
            tag: el.tagName,
            cls: (el.className && el.className.baseVal) || String(el.className).slice(0, 60),
            right: Math.round(r.right),
            text: (el.textContent || '').trim().slice(0, 40),
          });
          if (offenders.length > 12) break;
        }
      }
      return { docOverflowPx: doc, offenders };
    });
    results.consoleErrors320 = errs320;
    await p320.screenshot({ path: `${OUT}/harness-320-dark.png`, fullPage: true });
    await ctx320.close();

    // Sibling harness: today-panels must be unaffected.
    const p2 = await ctx.newPage();
    const errsPanels = [];
    attachConsole(p2, errsPanels);
    const resp = await p2.goto(`${BASE}/dev/fixtures/today-panels`, { waitUntil: 'networkidle', timeout: 60000 });
    await p2.waitForTimeout(800);
    results.todayPanels = {
      status: resp.status(),
      panelCount: await p2.locator('[data-panel-role]').count(),
      consoleErrors: errsPanels,
    };
    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 1));
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
