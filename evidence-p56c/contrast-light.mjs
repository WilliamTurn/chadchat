/** Focused light-theme contrast re-probe with raw color dump for diagnosis. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3600";
const ROUTE = "/dev/fixtures/today-panels";

function probe() {
  function parseColor(c) {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) {
      return null;
    }
    const parts = m[1].split(/[ ,/]+/).map((s) => parseFloat(s));
    return {
      r: parts[0],
      g: parts[1],
      b: parts[2],
      a: parts[3] === undefined ? 1 : parts[3],
    };
  }
  function lum({ r, g, b }) {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function ratio(a, b) {
    const L1 = lum(a);
    const L2 = lum(b);
    const hi = Math.max(L1, L2);
    const lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function effBg(el) {
    let node = el;
    while (node) {
      const s = getComputedStyle(node);
      const c = parseColor(s.backgroundColor);
      if (c && c.a > 0) {
        return c;
      }
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  const panels = [...document.querySelectorAll('[data-panel-role="quick-log"]')];
  const results = [];
  let seen = 0;
  for (const p of panels) {
    const sec = p.closest("section");
    const secLabel = sec?.querySelector("h2")?.textContent.trim() ?? "?";
    const texts = [...p.querySelectorAll("p,span,a,h3,button,div,li")].filter(
      (el) =>
        [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    );
    for (const el of texts) {
      seen++;
      const s = getComputedStyle(el);
      const fg = parseColor(s.color);
      const bg = effBg(el);
      const a = fg && fg.a !== undefined ? fg.a : 1;
      let cr = null;
      if (fg) {
        const blended = {
          r: fg.r * a + bg.r * (1 - a),
          g: fg.g * a + bg.g * (1 - a),
          b: fg.b * a + bg.b * (1 - a),
        };
        cr = Math.round(ratio(blended, bg) * 100) / 100;
      }
      const fs = parseFloat(s.fontSize);
      const fw = parseInt(s.fontWeight, 10) || 400;
      const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
      const threshold = large ? 3 : 4.5;
      results.push({
        section: secLabel,
        state: p.getAttribute("data-panel-state"),
        text: (el.textContent || "").trim().slice(0, 28),
        rawColor: s.color,
        rawBg: s.backgroundColor,
        effBg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
        fontSize: fs,
        weight: fw,
        ratio: cr,
        large,
        threshold,
        pass: cr === null ? null : cr >= threshold,
      });
    }
  }
  return { seenCount: seen, results };
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    colorScheme: "light",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("theme", "light");
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const data = await page.evaluate(probe);
  writeFileSync(
    join(process.cwd(), "evidence-p56c", "harness", "contrast-light.json"),
    `${JSON.stringify(data, null, 2)}\n`
  );
  const fails = data.results.filter((r) => r.pass === false);
  const nulls = data.results.filter((r) => r.pass === null);
  console.log(
    `light: seen=${data.seenCount} captured=${data.results.length} fails=${fails.length} nulls=${nulls.length}`
  );
  const mins = [...data.results]
    .filter((r) => r.ratio !== null)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 12);
  console.log("lowest 12 ratios:");
  for (const r of mins) {
    console.log(
      `  ${r.ratio}  [${r.threshold}] ${r.pass ? "PASS" : "FAIL"}  ${r.section}/${r.state}  "${r.text}"  ${r.rawColor} on ${r.effBg}`
    );
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
