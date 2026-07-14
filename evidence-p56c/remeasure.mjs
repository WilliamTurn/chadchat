/**
 * P56-C RE-MEASURE (post-fix), node Playwright, no MCP.
 * 1. Panel heights at 1440 + 320 (dark): rendered vs data-height-min/-max.
 *    Effective max = max at 1440, max*1.25 at 320.
 * 2. Light-theme contrast spot-check (1440, light) in the "consistent"
 *    section: macro labels/values, sleep footer status, hydration "to go",
 *    headline context lines. Canvas-resolves lab()/oklab()/oklch()/color-mix.
 * 3. Horizontal overflow at 320/360/390 (dark).
 * 4. Four full-page screenshots -> harness/postfix-<theme>-<width>.png.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.FIXTURE_BASE_URL ?? "http://localhost:3600";
const ROUTE = "/dev/fixtures/today-panels";
const OUT = join(process.cwd(), "evidence-p56c", "harness");
mkdirSync(OUT, { recursive: true });

const PANEL_NAMES = ["Nutrition", "Hydration", "Sleep"];

const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  nextjs-portal { display: none !important; }
`;

/* ---- height probe (per section = persona, per panel by index) ---- */
function heightProbe(names) {
  const sections = [...document.querySelectorAll("section")];
  const out = [];
  for (const sec of sections) {
    const h2 = sec.querySelector("h2");
    const label = h2 ? h2.textContent.trim() : "(no-h2)";
    const panels = [...sec.querySelectorAll('[data-panel-role="quick-log"]')];
    panels.forEach((p, i) => {
      const rect = p.getBoundingClientRect();
      out.push({
        persona: label,
        panel: names[i] ?? `panel-${i}`,
        state: p.getAttribute("data-panel-state"),
        height: Math.round(rect.height),
        min: Number(p.getAttribute("data-height-min")),
        max: Number(p.getAttribute("data-height-max")),
      });
    });
  }
  return out;
}

/* ---- overflow probe ---- */
function overflowProbe() {
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  };
}

/* ---- canvas-resolved contrast probe, consistent section only ---- */
function contrastProbe(names) {
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
  function effBg(el) {
    const chain = [];
    let node = el;
    while (node && node.nodeType === 1) {
      chain.push(toRGBA(getComputedStyle(node).backgroundColor));
      node = node.parentElement;
    }
    chain.push(themeBg.a > 0.01 ? themeBg : { r: 255, g: 255, b: 255, a: 1 });
    chain.reverse();
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

  const sections = [...document.querySelectorAll("section")];
  const sec = sections.find(
    (s) => s.querySelector("h2")?.textContent.trim() === "consistent"
  );
  if (!sec) {
    return { error: "no consistent section" };
  }
  const panels = [...sec.querySelectorAll('[data-panel-role="quick-log"]')];
  const results = [];
  panels.forEach((p, i) => {
    const panelName = names[i] ?? `panel-${i}`;
    const texts = [...p.querySelectorAll("p,span,a,h3,button,div,li")].filter(
      (el) =>
        [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    );
    for (const el of texts) {
      const s = getComputedStyle(el);
      const fg = toRGBA(s.color);
      const bg = effBg(el);
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
      // direct text only (exclude container divs whose text is really children)
      const ownText = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(" ")
        .trim();
      results.push({
        panel: panelName,
        tag: el.tagName.toLowerCase(),
        className: el.getAttribute("class") || "",
        ownText: ownText.slice(0, 40),
        fullText: (el.textContent || "").trim().slice(0, 50),
        fg: `rgb(${fg.r},${fg.g},${fg.b})${a < 1 ? ` a${a.toFixed(2)}` : ""}`,
        bg: `rgb(${bg.r},${bg.g},${bg.b})`,
        fontSize: Math.round(fs * 10) / 10,
        weight: fw,
        ratio: Math.round(cr * 100) / 100,
        large,
        threshold,
        pass: cr >= threshold,
      });
    }
  });
  return { results };
}

async function main() {
  const browser = await chromium.launch();
  const measurements = {
    heights: { 1440: [], 320: [] },
    overflow: [],
    contrastLight: null,
  };
  try {
    // ---------- DARK: heights (1440, 320) + overflow (320,360,390) + shots
    const darkCtx = await browser.newContext({
      colorScheme: "dark",
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    await darkCtx.addInitScript(() =>
      window.localStorage.setItem("theme", "dark")
    );
    const darkPage = await darkCtx.newPage();

    for (const width of [1440, 390, 360, 320]) {
      await darkPage.setViewportSize({ width, height: 900 });
      await darkPage.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
      await darkPage.addStyleTag({ content: FREEZE_CSS });
      await darkPage.evaluate(() => document.fonts.ready);
      const docHeight = await darkPage.evaluate(
        () => document.documentElement.scrollHeight
      );

      if (width === 1440 || width === 320) {
        const h = await darkPage.evaluate(heightProbe, PANEL_NAMES);
        measurements.heights[width] = h;
      }
      if (width === 320 || width === 360 || width === 390) {
        const ov = await darkPage.evaluate(overflowProbe);
        measurements.overflow.push({ theme: "dark", width, ...ov });
      }
      if (width === 1440 || width === 390) {
        await darkPage.setViewportSize({
          width,
          height: Math.min(Math.max(900, docHeight), 20000),
        });
        await darkPage.evaluate(() => document.fonts.ready);
        await darkPage.screenshot({
          path: join(OUT, `postfix-dark-${width}.png`),
          fullPage: true,
        });
      }
      process.stdout.write(`\rdark ${width}px done        `);
    }
    await darkCtx.close();

    // ---------- LIGHT: contrast (1440) + shots (1440, 390)
    const lightCtx = await browser.newContext({
      colorScheme: "light",
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    await lightCtx.addInitScript(() =>
      window.localStorage.setItem("theme", "light")
    );
    const lightPage = await lightCtx.newPage();

    for (const width of [1440, 390]) {
      await lightPage.setViewportSize({ width, height: 900 });
      await lightPage.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
      await lightPage.addStyleTag({ content: FREEZE_CSS });
      await lightPage.evaluate(() => document.fonts.ready);
      const docHeight = await lightPage.evaluate(
        () => document.documentElement.scrollHeight
      );
      if (width === 1440) {
        measurements.contrastLight = await lightPage.evaluate(
          contrastProbe,
          PANEL_NAMES
        );
      }
      await lightPage.setViewportSize({
        width,
        height: Math.min(Math.max(900, docHeight), 20000),
      });
      await lightPage.evaluate(() => document.fonts.ready);
      await lightPage.screenshot({
        path: join(OUT, `postfix-light-${width}.png`),
        fullPage: true,
      });
      process.stdout.write(`\rlight ${width}px done        `);
    }
    await lightCtx.close();
  } finally {
    await browser.close();
  }

  writeFileSync(
    join(OUT, "remeasure.json"),
    `${JSON.stringify(measurements, null, 2)}\n`
  );
  console.log("\nremeasure complete -> evidence-p56c/harness/remeasure.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
