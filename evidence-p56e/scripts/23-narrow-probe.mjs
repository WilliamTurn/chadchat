// Probe the two wrapping cards on /today @1440: card inner width, title glyph
// width, link glyph width, title line count — to judge necessary vs unnecessary wrap.
import { chromium, BASE, newCtx, attachConsole, applyTheme } from './pw.mjs';
import fs from 'node:fs';
const STATE = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/scripts/state.json';
const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));

function probe() {
  const textW = (node) => {
    const r = document.createRange(); r.selectNodeContents(node);
    const rs = [...r.getClientRects()];
    if (!rs.length) return { w: 0, lines: 0 };
    const tops = new Set(rs.map((x) => Math.round(x.top)));
    return { w: Math.round(Math.max(...rs.map((x) => x.right)) - Math.min(...rs.map((x) => x.left))), lines: tops.size };
  };
  const out = [];
  for (const h2 of document.querySelectorAll('h2')) {
    const spans = h2.querySelectorAll(':scope > span');
    const titleSpan = spans[spans.length - 1];
    if (!titleSpan) continue;
    const title = titleSpan.textContent.trim();
    if (!/meal plan today|primary goal/i.test(title)) continue;
    const parent = h2.parentElement;
    const link = parent.querySelector(':scope > a');
    const header = parent.getBoundingClientRect();
    const tw = textW(titleSpan);
    const lw = link ? textW(link) : null;
    // icon chip width + gap
    const chip = spans[0] ? spans[0].getBoundingClientRect().width : 0;
    out.push({
      title,
      headerInnerWidth: Math.round(header.width),
      iconChipW: Math.round(chip),
      titleTextW: tw.w, titleLines: tw.lines,
      linkTextW: lw ? lw.w : null,
      // would-fit-on-one-row estimate: chip + gap(10) + title + gap(8) + link
      needOneRow: Math.round(chip + 10 + tw.w + 8 + (lw ? lw.w : 0)),
    });
  }
  return out;
}

async function run() {
  const browser = await chromium.launch();
  try {
    const ctx = await newCtx(browser, { width: 1440, height: 1000, theme: 'dark', touch: false });
    await ctx.addCookies(state.cookies);
    const page = await ctx.newPage();
    const errs = []; attachConsole(page, errs);
    await page.goto(`${BASE}/today`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    await applyTheme(page, 'dark');
    console.log(JSON.stringify(await page.evaluate(probe), null, 1));
    await ctx.close();
  } finally { await browser.close(); }
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
