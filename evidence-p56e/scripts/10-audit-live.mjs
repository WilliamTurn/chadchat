// P56-E pre-delivery audit: live /today + /plans (Pro test account, READ-ONLY).
// Console errors + AA contrast on the new copy lines, both themes, plus
// touch-target measurements at 390px. Navigation and evaluation only.
import { chromium, BASE, newCtx, attachConsole, applyTheme } from './pw.mjs';

const STATE = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/scripts/state.json';
const OUT = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/audit';

// In-page helpers: effective background compositing + WCAG ratio.
const CONTRAST_LIB = `
  const __cv = document.createElement('canvas');
  __cv.width = 1; __cv.height = 1;
  const __cx = __cv.getContext('2d', { willReadFrequently: true });
  function parseColor(s) {
    // Canvas normalizes any CSS color (incl. oklch) to premultiplied RGBA.
    __cx.clearRect(0, 0, 1, 1);
    __cx.fillStyle = '#000';
    __cx.fillStyle = s; // invalid strings keep #000
    __cx.fillRect(0, 0, 1, 1);
    const d = __cx.getImageData(0, 0, 1, 1).data;
    const a = d[3] / 255;
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return { r: d[0], g: d[1], b: d[2], a };
  }
  function blend(fg, bg) {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  }
  function effectiveBg(el) {
    // Composite ancestor backgrounds bottom-up until opaque.
    const layers = [];
    let n = el;
    while (n && n instanceof Element) {
      const c = parseColor(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
      n = n.parentElement;
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    const rootDark = document.documentElement.classList.contains('dark');
    if (rootDark) bg = { r: 0, g: 0, b: 0, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg);
    return bg;
  }
  function lum(c) {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratioOf(el) {
    const cs = getComputedStyle(el);
    let fg = parseColor(cs.color);
    const bg = effectiveBg(el.parentElement || el);
    if (fg.a < 1) fg = blend(fg, bg);
    const l1 = lum(fg), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return {
      ratio: Math.round(ratio * 100) / 100,
      fontPx: parseFloat(cs.fontSize),
      weight: cs.fontWeight,
      color: cs.color,
      bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
    };
  }
`;

async function contrastReport(page) {
  return await page.evaluate(`(() => {
    ${CONTRAST_LIB}
    const out = [];
    const seen = new Set();
    const push = (label, el) => {
      if (!el) return;
      const text = (el.textContent || '').trim().slice(0, 80);
      if (!text) return;
      const key = label + '|' + text;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ label, text, ...ratioOf(el) });
    };
    // 1) SegmentStrip caption / reason lines + "of N" lines: .text-meta
    //    inside panels that contain a [role=img] strip.
    for (const card of document.querySelectorAll('[data-panel-role]')) {
      const role = card.getAttribute('data-panel-role');
      for (const el of card.querySelectorAll('p.text-meta, span.text-meta')) {
        push('text-meta (' + role + ')', el);
      }
      for (const el of card.querySelectorAll('.text-body-sm')) {
        if (el.classList.contains('text-muted-foreground')) {
          push('body-sm muted (' + role + ')', el);
        }
      }
    }
    // 2) Meal chips (font-display value + label pairs in bg-background/40).
    for (const el of document.querySelectorAll('[data-panel-role] .rounded-xl.border .text-meta, [data-panel-role] .rounded-lg.border')) {
      push('chip', el);
    }
    return out;
  })()`);
}

async function auditPage(page, url, name, results) {
  const errs = [];
  attachConsole(page, errs);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  for (const theme of ['dark', 'light']) {
    await applyTheme(page, theme);
    await page.waitForTimeout(300);
    const contrast = await contrastReport(page);
    results.push({ page: name, theme, contrast });
    await page.screenshot({ path: `${OUT}/${name}-1440-${theme}.png`, fullPage: true });
  }
  results.push({ page: name, consoleErrors: errs });
}

async function run() {
  const browser = await chromium.launch();
  const results = [];
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
      storageState: STATE,
    });
    await ctx.addInitScript(() => {
      try { window.localStorage.setItem('theme', 'dark'); } catch {}
    });
    const page = await ctx.newPage();
    await auditPage(page, `${BASE}/today`, 'today', results);
    await auditPage(page, `${BASE}/plans`, 'plans', results);
    await ctx.close();

    // 390px touch pass: measure the new tap targets in the plans/goals band.
    const mctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
      storageState: STATE,
    });
    const mpage = await mctx.newPage();
    const merrs = [];
    attachConsole(mpage, merrs);
    await mpage.goto(`${BASE}/today`, { waitUntil: 'networkidle', timeout: 60000 });
    await mpage.waitForTimeout(1200);
    const targets = await mpage.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('[data-panel-role] a, [data-panel-role] button')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        out.push({
          text: (el.textContent || '').trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
      return out;
    });
    const overflow390 = await mpage.evaluate(
      () => document.scrollingElement.scrollWidth - window.innerWidth
    );
    results.push({ page: 'today@390', touchTargets: targets.filter((t) => t.h < 44 || t.w < 44), overflowPx: overflow390, consoleErrors: merrs });
    await mpage.screenshot({ path: `${OUT}/today-390-dark-audit.png`, fullPage: true });
    await mctx.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 1));
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
