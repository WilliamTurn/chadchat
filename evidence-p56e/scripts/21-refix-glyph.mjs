// P56-E refix verification, precise pass: item 2 (header collision) measured on
// the VISIBLE GLYPH rects (Range-based), so the 44px touch-target padding on the
// link's hit box does not create false collisions; item 4 ("All goals (N)" body
// link) measured as the anchor hit box. Node Playwright only, no auth.
import { chromium, BASE, attachConsole, applyTheme } from './pw.mjs';

// In-page: for every ModuleHeader (div holding <h2> + optional view <a>),
// return the glyph rects of the title text and the link text.
function collectGlyphHeaders() {
  const textRect = (node) => {
    const r = document.createRange();
    r.selectNodeContents(node);
    const rects = [...r.getClientRects()];
    if (!rects.length) return null;
    const left = Math.min(...rects.map((x) => x.left));
    const right = Math.max(...rects.map((x) => x.right));
    const top = Math.min(...rects.map((x) => x.top));
    const bottom = Math.max(...rects.map((x) => x.bottom));
    return { left, right, top, bottom };
  };
  const out = [];
  for (const h2 of document.querySelectorAll('h2')) {
    const parent = h2.parentElement;
    if (!parent) continue;
    const spans = h2.querySelectorAll(':scope > span');
    const titleSpan = spans[spans.length - 1];
    if (!titleSpan) continue;
    const link = parent.querySelector(':scope > a');
    const tRect = textRect(titleSpan);
    if (!tRect) continue;
    const rec = {
      title: titleSpan.textContent.trim(),
      titleGlyph: {
        left: Math.round(tRect.left), right: Math.round(tRect.right),
        top: Math.round(tRect.top), bottom: Math.round(tRect.bottom),
      },
      hasLink: !!link,
    };
    if (link) {
      const lRect = textRect(link);
      const lBox = link.getBoundingClientRect();
      rec.linkText = link.textContent.trim().slice(0, 30);
      rec.linkGlyph = lRect ? {
        left: Math.round(lRect.left), right: Math.round(lRect.right),
        top: Math.round(lRect.top), bottom: Math.round(lRect.bottom),
      } : null;
      rec.linkBoxHeight = Math.round(lBox.height);
      if (lRect) {
        // Same visual row if glyph vertical bands overlap; then check horizontal.
        const vOverlap = tRect.top < lRect.bottom - 0.5 && lRect.top < tRect.bottom - 0.5;
        const hOverlap = tRect.left < lRect.right - 0.5 && lRect.left < tRect.right - 0.5;
        rec.sameRow = vOverlap;
        rec.glyphCollision = vOverlap && hOverlap;
        rec.linkWrappedBelow = lRect.top >= tRect.bottom - 1;
        rec.gapPx = Math.round(lRect.left - tRect.right); // >0 = link starts right of title
      }
    }
    out.push(rec);
  }
  return out;
}

function collectAllGoalsLinks() {
  const out = [];
  for (const a of document.querySelectorAll('a[href="/goals"], a[href^="/goals"]')) {
    const t = a.textContent.trim();
    if (!/all goals/i.test(t)) continue;
    const b = a.getBoundingClientRect();
    out.push({ text: t.slice(0, 30), height: Math.round(b.height), width: Math.round(b.width),
      rect: { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom) } });
  }
  return out;
}

async function open(browser, { width, theme, path, touch }) {
  const ctx = await browser.newContext({
    viewport: { width, height: 1400 },
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
  return { ctx, page, errs };
}

async function run() {
  const browser = await chromium.launch();
  const report = {};
  try {
    // ITEM 2 (glyph-precise): plans-goals + roles + panels at 320/360, light/dark
    report.item2 = {};
    for (const path of ['/dev/fixtures/plans-goals', '/dev/fixtures/roles', '/dev/fixtures/panels']) {
      report.item2[path] = {};
      for (const width of [320, 360]) {
        for (const theme of ['light', 'dark']) {
          const { ctx, page } = await open(browser, { width, theme, path, touch: true });
          const headers = await page.evaluate(collectGlyphHeaders);
          await ctx.close();
          const withLink = headers.filter((h) => h.hasLink && h.linkGlyph);
          const collisions = withLink.filter((h) => h.glyphCollision);
          const wrapped = withLink.filter((h) => h.linkWrappedBelow);
          const sameRow = withLink.filter((h) => h.sameRow && !h.linkWrappedBelow);
          report.item2[path][`${width}-${theme}`] = {
            headersWithLink: withLink.length,
            glyphCollisions: collisions.length,
            wrappedBelow: wrapped.length,
            sameRowSideBySide: sameRow.length,
            minGapSameRow: sameRow.length ? Math.min(...sameRow.map((h) => h.gapPx)) : null,
            collisionDetail: collisions.map((h) => ({ title: h.title, titleGlyph: h.titleGlyph, linkGlyph: h.linkGlyph, gapPx: h.gapPx })),
          };
        }
      }
    }

    // ITEM 4: "All goals (N)" anchor hit box height >= 44 at 390
    {
      const { ctx, page } = await open(browser, { width: 390, theme: 'dark', path: '/dev/fixtures/plans-goals', touch: true });
      const links = await page.evaluate(collectAllGoalsLinks);
      await ctx.close();
      report.item4 = { found: links.length, links, allPass: links.length > 0 && links.every((l) => l.height >= 44) };
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 1));
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
