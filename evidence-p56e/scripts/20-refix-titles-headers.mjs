// P56-E refix verification: items 1 (title truncation), 2 (header collision),
// 4 ("All goals" hit box). No auth needed. Node Playwright only.
import { chromium, BASE, attachConsole, applyTheme } from './pw.mjs';

const OUT = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/ours';

const SIX_TITLES = [
  'TRAINING TODAY', 'MEAL PLAN TODAY', 'PRIMARY GOAL',
  'TRAINING THIS WEEK', 'NUTRITION ADHERENCE', 'RECOVERY CONSISTENCY',
];

// In-page: collect every ModuleHeader (a div directly containing an <h2>
// whose last child span is the canonical title). Returns per-header metrics.
function collectHeaders() {
  const rectsOverlapX = (a, b) => a.left < b.right && b.left < a.right;
  const out = [];
  for (const h2 of document.querySelectorAll('h2')) {
    const parent = h2.parentElement;
    if (!parent) continue;
    // title span = last element child of h2 (icon chip is first)
    const spans = h2.querySelectorAll(':scope > span');
    const titleSpan = spans[spans.length - 1];
    if (!titleSpan) continue;
    const titleText = titleSpan.textContent.trim();
    if (!titleText) continue;
    // The header row: the div that holds h2 and (optionally) the view link.
    // Identify the persona section (nearest ancestor with an h1/section h2 label).
    let sectionLabel = '';
    let sec = parent.closest('section');
    if (sec) {
      const secH = sec.querySelector(':scope > h2, :scope > header h2, h2');
      // the persona/section heading is a different h2; grab the closest heading text above
    }
    const link = parent.querySelector(':scope > a');
    const tRect = titleSpan.getBoundingClientRect();
    const rec = {
      title: titleText,
      titleScrollW: titleSpan.scrollWidth,
      titleClientW: titleSpan.clientWidth,
      clips: titleSpan.scrollWidth > titleSpan.clientWidth + 1,
      titleRect: { left: Math.round(tRect.left), right: Math.round(tRect.right), top: Math.round(tRect.top), bottom: Math.round(tRect.bottom) },
      hasLink: !!link,
    };
    if (link) {
      const lRect = link.getBoundingClientRect();
      rec.linkText = link.textContent.trim().slice(0, 30);
      rec.linkRect = { left: Math.round(lRect.left), right: Math.round(lRect.right), top: Math.round(lRect.top), bottom: Math.round(lRect.bottom) };
      rec.linkHeight = Math.round(lRect.height);
      // Horizontal intersection only counts if they also share vertical space
      const vOverlap = tRect.top < lRect.bottom - 1 && lRect.top < tRect.bottom - 1;
      rec.hOverlap = vOverlap && rectsOverlapX(tRect, lRect);
      rec.linkWrapped = lRect.top >= tRect.bottom - 1; // link dropped to its own line
    }
    out.push(rec);
  }
  return out;
}

async function measure(browser, { width, theme, path, touch = false }) {
  const ctx = await browser.newContext({
    viewport: { width, height: 1200 },
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1,
  });
  await ctx.addInitScript((t) => { try { window.localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  const errs = [];
  attachConsole(page, errs);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await applyTheme(page, theme);
  const headers = await page.evaluate(collectHeaders);
  await ctx.close();
  return { headers, errs };
}

async function run() {
  const browser = await chromium.launch();
  const report = {};
  try {
    // ITEM 1: title truncation on plans-goals at 1440/390/320 (dark is enough for geometry; theme doesn't change layout, but do both at 320 for #2)
    report.item1 = {};
    for (const width of [1440, 390, 320]) {
      const { headers } = await measure(browser, { width, theme: 'dark', path: '/dev/fixtures/plans-goals', touch: width < 700 });
      const six = headers.filter((h) => SIX_TITLES.includes(h.title.toUpperCase()));
      const clipped = six.filter((h) => h.clips);
      report.item1[width] = {
        sixTitleInstances: six.length,
        clippedCount: clipped.length,
        clipped: clipped.map((h) => ({ title: h.title, scrollW: h.titleScrollW, clientW: h.titleClientW })),
      };
    }

    // ITEM 2: header collision on plans-goals + roles + panels, 320 & 360, light & dark
    report.item2 = {};
    for (const path of ['/dev/fixtures/plans-goals', '/dev/fixtures/roles', '/dev/fixtures/panels']) {
      report.item2[path] = {};
      for (const width of [320, 360]) {
        for (const theme of ['light', 'dark']) {
          const { headers } = await measure(browser, { width, theme, path, touch: true });
          const withLink = headers.filter((h) => h.hasLink);
          const collisions = withLink.filter((h) => h.hOverlap);
          report.item2[path][`${width}-${theme}`] = {
            headersWithLink: withLink.length,
            collisions: collisions.length,
            wrappedLinks: withLink.filter((h) => h.linkWrapped).length,
            collisionDetail: collisions.map((h) => ({ title: h.title, titleRect: h.titleRect, linkRect: h.linkRect })),
          };
        }
      }
    }

    // ITEM 4: "All goals (N)" link hit box height >= 44 on plans-goals @390
    {
      const { headers } = await measure(browser, { width: 390, theme: 'dark', path: '/dev/fixtures/plans-goals', touch: true });
      const goalLinks = headers.filter((h) => h.hasLink && /all goals/i.test(h.linkText));
      report.item4 = {
        found: goalLinks.length,
        links: goalLinks.map((h) => ({ title: h.title, linkText: h.linkText, height: h.linkHeight, rect: h.linkRect })),
      };
    }

    // SCREENSHOTS for item 2 record: harness + roles at 320 dark
    for (const [path, name] of [['/dev/fixtures/plans-goals', 'refix-header-harness-320-dark'], ['/dev/fixtures/roles', 'refix-header-roles-320-dark']]) {
      const ctx = await browser.newContext({ viewport: { width: 320, height: 1400 }, colorScheme: 'dark', hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      await ctx.addInitScript(() => { try { window.localStorage.setItem('theme', 'dark'); } catch {} });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      await applyTheme(page, 'dark');
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 1));
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
