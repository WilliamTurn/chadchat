/**
 * Authoritative contrast probe for BOTH themes. Resolves every CSS color
 * (rgb / lab / oklab / oklch / color-mix) to sRGB bytes via a canvas so the
 * numbers match what the browser actually paints, then computes WCAG contrast
 * for every text-bearing element inside every quick-log panel.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3600";
const ROUTE = "/dev/fixtures/today-panels";

function probe() {
  const cv = document.createElement("canvas");
  cv.width = 1;
  cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  function toRGBA(colorStr) {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = colorStr; // browser resolves any color space
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
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
  const themeBg = toRGBA(getComputedStyle(document.body).backgroundColor);
  // Composite the full background stack (element's own bg + every ancestor)
  // down to a single opaque color, honoring semi-transparent accent tints.
  function effBg(el) {
    const chain = [];
    let node = el;
    while (node && node.nodeType === 1) {
      chain.push(toRGBA(getComputedStyle(node).backgroundColor));
      node = node.parentElement;
    }
    chain.push(themeBg.a > 0.01 ? themeBg : { r: 255, g: 255, b: 255, a: 1 });
    chain.reverse(); // outermost base first
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of chain) {
      if (layer.a >= 0.999) {
        base = { r: layer.r, g: layer.g, b: layer.b, a: 1 };
        continue;
      }
      if (layer.a <= 0.001) {
        continue;
      }
      const a = layer.a;
      base = {
        r: layer.r * a + base.r * (1 - a),
        g: layer.g * a + base.g * (1 - a),
        b: layer.b * a + base.b * (1 - a),
        a: 1,
      };
    }
    return base;
  }
  const panels = [...document.querySelectorAll('[data-panel-role="quick-log"]')];
  const results = [];
  for (const p of panels) {
    const sec = p.closest("section");
    const secLabel = sec?.querySelector("h2")?.textContent.trim() ?? "?";
    const texts = [...p.querySelectorAll("p,span,a,h3,button,div,li")].filter(
      (el) =>
        [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    );
    for (const el of texts) {
      const s = getComputedStyle(el);
      const fg = toRGBA(s.color);
      let bg = effBg(el);
      // blend fg alpha over its effective (opaque) background
      const a = fg.a;
      const blended = {
        r: fg.r * a + bg.r * (1 - a),
        g: fg.g * a + bg.g * (1 - a),
        b: fg.b * a + bg.b * (1 - a),
      };
      const cr = ratio(blended, bg);
      const fs = parseFloat(s.fontSize);
      const fw = parseInt(s.fontWeight, 10) || 400;
      const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
      const threshold = large ? 3 : 4.5;
      results.push({
        section: secLabel,
        state: p.getAttribute("data-panel-state"),
        text: (el.textContent || "").trim().slice(0, 30),
        fg: `rgb(${fg.r},${fg.g},${fg.b})${a < 1 ? ` a${a.toFixed(2)}` : ""}`,
        bg: `rgb(${bg.r},${bg.g},${bg.b})`,
        fontSize: fs,
        weight: fw,
        ratio: Math.round(cr * 100) / 100,
        large,
        threshold,
        pass: cr >= threshold,
      });
    }
  }
  return results;
}

async function main() {
  const browser = await chromium.launch();
  const all = {};
  for (const theme of ["dark", "light"]) {
    const context = await browser.newContext({
      colorScheme: theme,
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    await context.addInitScript((t) => {
      window.localStorage.setItem("theme", t);
    }, theme);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    all[theme] = await page.evaluate(probe);
    await context.close();
  }
  writeFileSync(
    join(process.cwd(), "evidence-p56c", "harness", "contrast-both.json"),
    `${JSON.stringify(all, null, 2)}\n`
  );
  for (const theme of ["dark", "light"]) {
    const rows = all[theme];
    const fails = rows.filter((r) => !r.pass);
    console.log(`\n=== ${theme}: ${rows.length} text els, ${fails.length} FAIL ===`);
    const mins = [...rows].sort((a, b) => a.ratio - b.ratio).slice(0, 10);
    for (const r of mins) {
      console.log(
        `  ${r.ratio.toFixed(2)} [${r.threshold}] ${r.pass ? "ok" : "FAIL"}  ${r.section}/${r.state} "${r.text}" ${r.fg} on ${r.bg} (${r.fontSize}px/${r.weight})`
      );
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
