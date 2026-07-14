import { chromium, BASE, newCtx, attachConsole } from './pw.mjs';

const OUT = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/ours';
const STATE = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/scripts/state.json';

async function ctxFrom(browser, opts) {
  const ctx = await newCtx(browser, opts);
  await ctx.addCookies(JSON.parse((await import('node:fs')).readFileSync?.(STATE) ?? '{}')?.cookies ?? []);
  return ctx;
}

async function run() {
  const fs = await import('node:fs');
  const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const browser = await chromium.launch();
  const out = { desktop: {}, mobile: {} };
  try {
    // ---- 1440 desktop dark ----
    {
      const ctx = await newCtx(browser, { width: 1440, height: 1000, theme: 'dark' });
      await ctx.addCookies(state.cookies);
      const page = await ctx.newPage();
      const errs = [];
      attachConsole(page, errs);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/today-1440-dark.png`, fullPage: true });
      // Which bands / panels are present
      const headings = await page.locator('h2').allInnerTexts();
      out.desktop = { errs, headings };
      // Reconciliation data capture on this same load:
      out.desktop.bodyText = await page.locator('body').innerText();
      await ctx.close();
    }

    // ---- 390 mobile dark, touch ----
    {
      const ctx = await newCtx(browser, { width: 390, height: 844, theme: 'dark', touch: true });
      await ctx.addCookies(state.cookies);
      const page = await ctx.newPage();
      const errs = [];
      attachConsole(page, errs);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/today-390-dark.png`, fullPage: true });

      // Measure interactive controls inside the two new bands
      const measure = await page.evaluate(() => {
        const bandTitles = ['Plans and goals', 'Progress highlights'];
        const results = [];
        const sections = Array.from(document.querySelectorAll('section'));
        for (const title of bandTitles) {
          const sec = sections.find((s) => {
            const h = s.querySelector('h2');
            return h && h.textContent.trim() === title;
          });
          if (!sec) { results.push({ band: title, found: false }); continue; }
          const controls = Array.from(sec.querySelectorAll('a, button, [role="button"]'));
          for (const el of controls) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue; // hidden
            const isInlineProse = !!el.closest('p'); // small inline text link in prose
            results.push({
              band: title,
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().slice(0, 40),
              w: Math.round(r.width),
              h: Math.round(r.height),
              inlineProse: isInlineProse,
              under44: (r.width < 44 || r.height < 44),
            });
          }
        }
        return results;
      });
      out.mobile = { errs, touchTargets: measure };
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(`${OUT}/../scripts/today-data.json`, JSON.stringify(out, null, 2));
  // Print summary (omit long bodyText)
  const { bodyText, ...deskRest } = out.desktop;
  console.log(JSON.stringify({ desktop: deskRest, mobile: out.mobile }, null, 2));
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
