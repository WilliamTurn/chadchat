import { chromium } from "@playwright/test";
import fs from "node:fs";
const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/ours";
const BASE = "http://localhost:3600";

// Measure the named-card heatmap + volume card overlap on a full page (doc scope).
const MEASURE = () => {
  const figFor = (t) => {
    const h = [...document.querySelectorAll("h3")].find(
      (n) => (n.textContent || "").trim() === t
    );
    return h ? h.closest("figure") : null;
  };
  const consFig = figFor("Training consistency");
  const volFig = figFor("Training volume");
  let heat = null;
  if (consFig) {
    const weekCol = consFig.querySelector(".grid.grid-rows-7.flex-1");
    if (weekCol) {
      const cellsContainer = weekCol.parentElement;
      const wrapper = cellsContainer.parentElement;
      const wr = wrapper.getBoundingClientRect();
      const allCells = [...cellsContainer.querySelectorAll("span.aspect-square")];
      const maxCell = allCells.reduce((m, c) => {
        const r = c.getBoundingClientRect();
        return Math.max(m, r.height, r.width);
      }, 0);
      const first = allCells.find((c) => c.getBoundingClientRect().width > 0);
      const fr = first ? first.getBoundingClientRect() : null;
      heat = {
        wrapH: Math.round(wr.height),
        wrapBottom: Math.round(wr.bottom + window.scrollY),
        cellW: fr ? Math.round(fr.width * 10) / 10 : null,
        maxCellPx: Math.round(maxCell * 10) / 10,
        weekCols: allCells.length ? cellsContainer.querySelectorAll(".grid.grid-rows-7.flex-1").length : 0,
      };
    }
  }
  const rectOf = (f) => f ? {
    top: Math.round(f.getBoundingClientRect().top + window.scrollY),
    bottom: Math.round(f.getBoundingClientRect().bottom + window.scrollY),
    height: Math.round(f.getBoundingClientRect().height),
  } : null;
  const cons = rectOf(consFig), vol = rectOf(volFig);
  return {
    heat, cons, vol,
    overlap: heat && vol ? heat.wrapBottom > vol.top : null,
    heatInsideCard: heat && cons ? heat.wrapBottom <= cons.bottom + 2 : null,
    docHeight: Math.round(document.documentElement.scrollHeight),
    foundConsistency: !!consFig, foundVolume: !!volFig,
  };
};

// Overview page: measure EVERY calendar heatmap on the page (report-only).
const MEASURE_ALL_HEATMAPS = () => {
  const wraps = new Set();
  [...document.querySelectorAll(".grid.grid-rows-7.flex-1")].forEach((wc) => {
    const cellsContainer = wc.parentElement;
    if (cellsContainer) wraps.add(cellsContainer.parentElement);
  });
  const list = [...wraps].filter(Boolean).map((wrapper, i) => {
    const cellsContainer = wrapper.querySelector(".flex.min-w-0.flex-1") || wrapper;
    const cells = [...wrapper.querySelectorAll("span.aspect-square")];
    const maxCell = cells.reduce((m, c) => {
      const r = c.getBoundingClientRect();
      return Math.max(m, r.height, r.width);
    }, 0);
    const wr = wrapper.getBoundingClientRect();
    // does the wrapper overflow its nearest figure/card ancestor?
    const card = wrapper.closest("figure") || wrapper.parentElement;
    const cr = card ? card.getBoundingClientRect() : null;
    return {
      idx: i,
      wrapH: Math.round(wr.height),
      maxCellPx: Math.round(maxCell * 10) / 10,
      cellCount: cells.length,
      overflowsCard: cr ? Math.round(wr.bottom) > Math.round(cr.bottom) + 2 : null,
    };
  });
  return { heatmapCount: list.length, heatmaps: list, docHeight: Math.round(document.documentElement.scrollHeight) };
};

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "claude-testing@example.com");
  await page.fill('input[type="password"]', "12345678");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  await page.waitForTimeout(1500);
}

const results = {};
const b = await chromium.launch();
try {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.clearCookies();
  const p = await c.newPage();
  await login(p);

  // ---- /progress/training (live) ----
  await p.goto(`${BASE}/progress/training`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.documentElement.classList.add("dark"));
  await p.waitForTimeout(2500);
  results.live_training = await p.evaluate(MEASURE);
  await p.screenshot({
    path: `${OUT}/fix-heatmap-live-1440.png`,
    fullPage: true,
    clip: { x: 0, y: 0, width: 1440, height: Math.min(1400, results.live_training.docHeight) },
  });

  // ---- /progress overview (report-only, P56-A surface) ----
  await p.goto(`${BASE}/progress`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.documentElement.classList.add("dark"));
  await p.waitForTimeout(2500);
  results.overview = await p.evaluate(MEASURE_ALL_HEATMAPS);
  await p.screenshot({ path: `${OUT}/fix-heatmap-overview.png`, fullPage: true });
} catch (e) {
  results.error = String(e.stack || e);
} finally {
  await b.close();
  fs.writeFileSync(`${OUT}/fix-live-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
