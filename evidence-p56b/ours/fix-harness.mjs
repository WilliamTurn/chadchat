import { chromium } from "@playwright/test";
import fs from "node:fs";
const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/ours";
const BASE = "http://localhost:3600";

// In-page measurement: cards are <figure> with an <h3> title. Precise.
const MEASURE = (sectionSel) => {
  const root = sectionSel ? document.querySelector(sectionSel) : document;
  if (!root) return { error: "no section " + sectionSel };
  const figFor = (t) => {
    const h = [...root.querySelectorAll("h3")].find(
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
      const cellsContainer = weekCol.parentElement; // flex min-w-0 flex-1
      const wrapper = cellsContainer.parentElement; // flex min-w-0 gap-1.5
      const cells = [...weekCol.querySelectorAll("span.aspect-square")];
      const wr = wrapper.getBoundingClientRect();
      // measure a visible (painted) cell if present, else first
      const painted = cells.find((c) => {
        const s = getComputedStyle(c);
        return s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)";
      }) || cells[0];
      const cr = painted ? painted.getBoundingClientRect() : null;
      // largest cell height in the whole heatmap (catch any runaway)
      const allCells = [...cellsContainer.querySelectorAll("span.aspect-square")];
      const maxCell = allCells.reduce((m, c) => {
        const r = c.getBoundingClientRect();
        return Math.max(m, r.height, r.width);
      }, 0);
      heat = {
        wrapH: Math.round(wr.height),
        wrapW: Math.round(wr.width),
        wrapTop: Math.round(wr.top + window.scrollY),
        wrapBottom: Math.round(wr.bottom + window.scrollY),
        cellW: cr ? Math.round(cr.width * 10) / 10 : null,
        cellH: cr ? Math.round(cr.height * 10) / 10 : null,
        maxCellPx: Math.round(maxCell * 10) / 10,
        weekCols: cellsContainer.querySelectorAll(".grid.grid-rows-7.flex-1").length,
      };
    }
  }

  const rectOf = (f) => {
    if (!f) return null;
    const r = f.getBoundingClientRect();
    return {
      top: Math.round(r.top + window.scrollY),
      bottom: Math.round(r.bottom + window.scrollY),
      height: Math.round(r.height),
    };
  };
  const cons = rectOf(consFig);
  const vol = rectOf(volFig);

  // overlap of heatmap block into the volume card (true = BAD)
  let overlap = null;
  if (heat && vol) overlap = heat.wrapBottom > vol.top;

  // sanity: heatmap fully inside its own consistency card?
  let heatInsideCard = null;
  if (heat && cons) heatInsideCard = heat.wrapBottom <= cons.bottom + 2;

  return {
    heat,
    cons,
    vol,
    overlap,
    heatInsideCard,
    docHeight: Math.round(document.documentElement.scrollHeight),
  };
};

async function setDark(p) {
  await p.evaluate(() => {
    try { localStorage.setItem("theme", "dark"); } catch {}
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
  });
}

async function shoot(p, m, path, width) {
  // clip from consistency card top to volume card bottom, full page
  if (m.cons) {
    const bottom = m.vol ? m.vol.bottom : m.cons.bottom + 300;
    const y = Math.max(0, m.cons.top - 14);
    const height = Math.min(bottom - y + 18, 6000);
    await p.screenshot({
      path,
      fullPage: true,
      clip: { x: width === 390 ? 0 : 8, y, width: width === 390 ? 390 : 1424, height },
    });
  } else {
    await p.screenshot({ path, fullPage: true });
  }
}

const results = {};
const b = await chromium.launch();
try {
  // ---------- 1440 dark ----------
  {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await c.newPage();
    await p.goto(`${BASE}/dev/fixtures/training`, { waitUntil: "networkidle" });
    await setDark(p);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    await p.locator('section[aria-label="consistent"]').scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    const m = await p.evaluate(MEASURE, 'section[aria-label="consistent"]');
    results.harness_1440 = m;
    await shoot(p, m, `${OUT}/fix-heatmap-1440.png`, 1440);
    await c.close();
  }
  // ---------- 390 ----------
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await c.newPage();
    await p.goto(`${BASE}/dev/fixtures/training`, { waitUntil: "networkidle" });
    await setDark(p);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    await p.locator('section[aria-label="consistent"]').scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    const m = await p.evaluate(MEASURE, 'section[aria-label="consistent"]');
    results.harness_390 = m;
    await shoot(p, m, `${OUT}/fix-heatmap-390.png`, 390);
    await c.close();
  }
} catch (e) {
  results.error = String(e.stack || e);
} finally {
  await b.close();
  fs.writeFileSync(`${OUT}/fix-harness-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
