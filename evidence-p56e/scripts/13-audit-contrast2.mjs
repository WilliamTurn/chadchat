// Contrast pass 2: fixed effectiveBg (starts at the element itself) and
// covers /plans ModuleCard copy + all /today muted lines. READ-ONLY.
import { chromium, BASE, attachConsole, applyTheme } from './pw.mjs';

const STATE = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/scripts/state.json';

const LIB = `
  const __cv = document.createElement('canvas');
  __cv.width = 1; __cv.height = 1;
  const __cx = __cv.getContext('2d', { willReadFrequently: true });
  function parseColor(s) {
    __cx.clearRect(0, 0, 1, 1);
    __cx.fillStyle = '#000';
    __cx.fillStyle = s;
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
    const layers = [];
    let n = el; // start at the element ITSELF (buttons paint their own bg)
    while (n && n instanceof Element) {
      const c = parseColor(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
      n = n.parentElement;
    }
    const rootDark = document.documentElement.classList.contains('dark');
    let bg = rootDark ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg);
    return bg;
  }
  function lum(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratioOf(el) {
    const cs = getComputedStyle(el);
    const bg = effectiveBg(el);
    let fg = parseColor(cs.color);
    if (fg.a < 1) fg = blend(fg, bg);
    const l1 = lum(fg), l2 = lum(bg);
    return {
      ratio: Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100,
      fontPx: parseFloat(cs.fontSize),
      weight: cs.fontWeight,
    };
  }
`;

async function sample(page, scopeSel) {
  return await page.evaluate(`(() => {
    ${LIB}
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('${scopeSel}')) {
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const text = el.textContent.trim().slice(0, 70);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push({ text, ...ratioOf(el) });
    }
    return out;
  })()`);
}

async function run() {
  const browser = await chromium.launch();
  const results = [];
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: 'dark',
      storageState: STATE,
    });
    const page = await ctx.newPage();
    const errs = [];
    attachConsole(page, errs);

    // /today: every muted/meta line + chips + buttons in the new bands.
    await page.goto(`${BASE}/today`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);
    for (const theme of ['dark', 'light']) {
      await applyTheme(page, theme);
      await page.waitForTimeout(300);
      results.push({
        page: 'today', theme,
        samples: await sample(page, 'main p, main span, main a, main button, main h2'),
      });
    }

    // /plans: header copy + both ModuleCards.
    await page.goto(`${BASE}/plans`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);
    for (const theme of ['dark', 'light']) {
      await applyTheme(page, theme);
      await page.waitForTimeout(300);
      results.push({
        page: 'plans', theme,
        samples: await sample(page, 'main p, main span, main a, main button, main h1, main h2'),
      });
    }
    results.push({ consoleErrors: errs });
    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results));
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
