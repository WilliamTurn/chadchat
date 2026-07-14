import { makeBrowser, ctxFor, BASE, OUT } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const { browser, authCookies } = await makeBrowser();
const log = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };

const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 1000 }, "light");
await ctx.addInitScript(() => { try { localStorage.setItem("theme", "light"); } catch {} });
const page = await ctx.newPage();

async function htmlClass() { return await page.evaluate(() => document.documentElement.className); }

const contrastEval = () => page.evaluate(() => {
  const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(",").slice(0, 3).map((n) => parseFloat(n)) : null; };
  const ratio = (fg, bg) => { const a = lum(fg) + 0.05, b = lum(bg) + 0.05; return +((Math.max(a, b) / Math.min(a, b)).toFixed(2)); };
  const bgOf = (el) => { let e = el; while (e) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); const am = cs.backgroundColor.match(/rgba?\(([^)]+)\)/); const a = am ? (am[1].split(",")[3] ?? "1") : "1"; if (c && parseFloat(a) > 0.5) return c; e = e.parentElement; } return [255, 255, 255]; };
  const out = [];
  const push = (lab, el) => { if (!el) return; const fg = parse(getComputedStyle(el).color); const bg = bgOf(el.parentElement || el); if (fg) out.push({ lab, ratio: ratio(fg, bg), color: getComputedStyle(el).color, text: el.textContent.trim().slice(0, 26) }); };
  const panels = [...document.querySelectorAll("[data-panel-role='quick-log'][data-panel-state='populated']")].slice(0, 8);
  panels.forEach((p, i) => {
    push(`p${i}-metric`, p.querySelector(".text-metric,.text-metric-lg"));
    push(`p${i}-muted`, p.querySelector(".text-muted-foreground"));
    // amber "short" text + emerald "Goal met" + coverage
    p.querySelectorAll("span,p").forEach((el) => {
      const t = el.textContent.trim();
      if (/short$|short\b/.test(t) && t.length < 30 && el.children.length === 0) push(`p${i}-short`, el);
      if (/Goal met|Goal hit/.test(t) && t.length < 20 && el.children.length === 0) push(`p${i}-goalmet`, el);
    });
  });
  return out;
});

await page.goto(`${BASE}/dev/fixtures/today-panels`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(3000);
rec({ step: "fixtures-light-htmlClass", cls: await htmlClass() });
await page.screenshot({ path: `${OUT}/LIGHT-fixtures.png`, fullPage: true });
const c = await contrastEval();
rec({ step: "fixtures-light-contrast", min: Math.min(...c.map((x) => x.ratio)), belowAA: c.filter((x) => x.ratio < 4.5), all: c });

for (const [path, name] of [["/hydration", "hydration"], ["/sleep", "sleep"]]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  rec({ step: `${name}-light`, cls: await htmlClass(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth) });
  await page.screenshot({ path: `${OUT}/LIGHT-${name}.png`, fullPage: true });
}

writeFileSync(`${OUT}/light.json`, JSON.stringify(log, null, 2));
console.log("=== LIGHT DONE ===");
await ctx.close();
await browser.close();
