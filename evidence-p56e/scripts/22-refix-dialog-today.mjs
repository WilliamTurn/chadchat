// P56-E refix verification: item 3 (dialog auto-focus on /plans) and item 5
// (today desktop header links right-aligned, no wrap at 1440). Auth via state.json.
import { chromium, BASE, newCtx, attachConsole, applyTheme } from './pw.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/ours';
const STATE = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/scripts/state.json';
const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));

function collectGlyphHeaders() {
  const textRect = (node) => {
    const r = document.createRange();
    r.selectNodeContents(node);
    const rects = [...r.getClientRects()];
    if (!rects.length) return null;
    return {
      left: Math.min(...rects.map((x) => x.left)), right: Math.max(...rects.map((x) => x.right)),
      top: Math.min(...rects.map((x) => x.top)), bottom: Math.max(...rects.map((x) => x.bottom)),
    };
  };
  const out = [];
  for (const h2 of document.querySelectorAll('h2')) {
    const parent = h2.parentElement;
    if (!parent) continue;
    const spans = h2.querySelectorAll(':scope > span');
    const titleSpan = spans[spans.length - 1];
    if (!titleSpan) continue;
    const link = parent.querySelector(':scope > a');
    if (!link) continue;
    const t = textRect(titleSpan);
    const l = textRect(link);
    if (!t || !l) continue;
    out.push({
      title: titleSpan.textContent.trim(),
      linkText: link.textContent.trim().slice(0, 30),
      sameRow: t.top < l.bottom - 0.5 && l.top < t.bottom - 0.5,
      linkWrappedBelow: l.top >= t.bottom - 1,
      linkRightAligned: Math.round(l.right),
      titleRight: Math.round(t.right),
      gapPx: Math.round(l.left - t.right),
    });
  }
  return out;
}

async function run() {
  const browser = await chromium.launch();
  const report = {};
  try {
    // ---- ITEM 3: /plans Add-a-plan dialog auto-focus ----
    {
      const ctx = await newCtx(browser, { width: 390, height: 844, theme: 'dark', touch: true });
      await ctx.addCookies(state.cookies);
      const page = await ctx.newPage();
      const errs = [];
      attachConsole(page, errs);
      await page.goto(`${BASE}/plans`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(600);
      // Click the "Add a plan" / "Add plan" trigger.
      const trigger = page.getByRole('button', { name: /add a plan|add plan/i }).first();
      await trigger.click();
      // Wait for the dialog to be present, then IMMEDIATELY read activeElement.
      await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 });
      const focus = await page.evaluate(() => {
        const ae = document.activeElement;
        return {
          tag: ae ? ae.tagName : null,
          id: ae ? ae.id : null,
          role: ae ? ae.getAttribute('role') : null,
          isTitleInput: !!ae && ae.id === 'p-title',
        };
      });
      await page.screenshot({ path: `${OUT}/refix-dialog-open-390.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const closed = await page.getByRole('dialog').count();
      report.item3 = { focus, dialogClosedAfterEscape: closed === 0, errs, PASS: focus.isTitleInput === false };
      await ctx.close();
    }

    // ---- ITEM 5: /today desktop header links right-aligned at 1440 ----
    {
      const ctx = await newCtx(browser, { width: 1440, height: 1000, theme: 'dark', touch: false });
      await ctx.addCookies(state.cookies);
      const page = await ctx.newPage();
      const errs = [];
      attachConsole(page, errs);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      await applyTheme(page, 'dark');
      const headers = await page.evaluate(collectGlyphHeaders);
      const wrapped = headers.filter((h) => h.linkWrappedBelow);
      report.item5 = {
        headersWithLink: headers.length,
        wrappedAtDesktop: wrapped.length,
        wrappedDetail: wrapped.map((h) => ({ title: h.title, linkText: h.linkText })),
        allSameRow: wrapped.length === 0,
        sample: headers.slice(0, 12).map((h) => ({ title: h.title, link: h.linkText, gapPx: h.gapPx, sameRow: h.sameRow })),
        errs,
      };
      // Screenshot the two bands.
      for (const [label, name] of [['Plans and goals', 'refix-today-plans-goals-band-1440'], ['Progress highlights', 'refix-today-progress-highlights-band-1440']]) {
        const sec = page.locator('section').filter({ has: page.getByRole('heading', { name: label, exact: true }) }).first();
        if (await sec.count()) {
          await sec.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          await sec.screenshot({ path: `${OUT}/${name}.png` });
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 1));
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
