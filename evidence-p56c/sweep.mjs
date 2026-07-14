/**
 * P56-C HARNESS VERIFICATION SWEEP (node Playwright, no MCP).
 * Captures /dev/fixtures/today-panels at 5 widths x 2 themes, and gathers:
 *  - horizontal-overflow numbers at phone widths
 *  - quick-log panel rendered heights vs data-height-min/max (per section)
 *  - interactive-target bounding boxes in the "consistent" section (390 dark)
 *  - computed-color contrast ratios for text inside every quick-log panel
 * Writes screenshots to harness/<theme>-<width>.png and a measurements JSON.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.FIXTURE_BASE_URL ?? "http://localhost:3600";
const ROUTE = "/dev/fixtures/today-panels";
const OUT = join(process.cwd(), "evidence-p56c", "harness");
mkdirSync(OUT, { recursive: true });

const WIDTHS = [1440, 768, 390, 360, 320];
const THEMES = ["dark", "light"];
const PHONE = new Set([390, 360, 320]);

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

const PANEL_NAMES = ["Nutrition", "Hydration", "Sleep"];

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
        section: label,
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

function targetProbe(names) {
  const sections = [...document.querySelectorAll("section")];
  const sec = sections.find(
    (s) => s.querySelector("h2")?.textContent.trim() === "consistent"
  );
  if (!sec) {
    return { error: "no consistent section" };
  }
  const panels = [...sec.querySelectorAll('[data-panel-role="quick-log"]')];
  const out = [];
  panels.forEach((p, i) => {
    const interactives = [
      ...p.querySelectorAll('button, a, [role="button"], input, select'),
    ];
    for (const el of interactives) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        continue;
      }
      out.push({
        panel: names[i] ?? `panel-${i}`,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role"),
        text: (el.textContent || "").trim().slice(0, 40),
        ariaLabel: el.getAttribute("aria-label"),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
  });
  return out;
}

function contrastProbe() {
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
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  const panels = [...document.querySelectorAll('[data-panel-role="quick-log"]')];
  const results = [];
  for (const p of panels) {
    const sec = p.closest("section");
    const secLabel = sec?.querySelector("h2")?.textContent.trim() ?? "?";
    const texts = [...p.querySelectorAll("p,span,a,h3,button,div,li")].filter(
      (el) =>
        [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim()
        )
    );
    for (const el of texts) {
      const s = getComputedStyle(el);
      const fg = parseColor(s.color);
      if (!fg) {
        continue;
      }
      const bg = effBg(el);
      const a = fg.a === undefined ? 1 : fg.a;
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
        text: (el.textContent || "").trim().slice(0, 28),
        fontSize: Math.round(fs * 10) / 10,
        weight: fw,
        color: s.color,
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
  const measurements = {
    overflow: [],
    heights: [],
    targets: null,
    contrast: { dark: [], light: [] },
  };
  try {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        colorScheme: theme === "dark" ? "dark" : "light",
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      await context.addInitScript((t) => {
        window.localStorage.setItem("theme", t);
      }, theme);
      const page = await context.newPage();
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
        await page.addStyleTag({ content: FREEZE_CSS });
        await page.evaluate(() => document.fonts.ready);
        const docHeight = await page.evaluate(
          () => document.documentElement.scrollHeight
        );
        await page.setViewportSize({
          width,
          height: Math.min(Math.max(900, docHeight), 20_000),
        });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: join(OUT, `${theme}-${width}.png`),
          fullPage: false,
        });

        if (PHONE.has(width)) {
          const ov = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            bodyScrollWidth: document.body.scrollWidth,
          }));
          measurements.overflow.push({ theme, width, ...ov });
        }

        if (theme === "dark") {
          const h = await page.evaluate(heightProbe, PANEL_NAMES);
          for (const row of h) {
            measurements.heights.push({ width, ...row });
          }
        }

        if (theme === "dark" && width === 390) {
          measurements.targets = await page.evaluate(targetProbe, PANEL_NAMES);
        }

        if (width === 1440) {
          measurements.contrast[theme] = await page.evaluate(contrastProbe);
        }

        process.stdout.write(`\r${theme} ${width}px done        `);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  writeFileSync(
    join(OUT, "measurements.json"),
    `${JSON.stringify(measurements, null, 2)}\n`
  );
  console.log("\nsweep complete -> evidence-p56c/harness/measurements.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
