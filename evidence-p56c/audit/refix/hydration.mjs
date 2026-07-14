import { makeBrowser, ctxFor, BASE } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const OUT = "C:/Users/jon17/Desktop/chadchat/evidence-p56c/audit/refix";
const { browser, authCookies } = await makeBrowser();
const log = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };

const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 900 }, "dark");
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") rec({ consoleError: m.text().slice(0, 200) }); });
const dialogOpen = () => page.evaluate(() => !!document.querySelector('[role="dialog"],[role="alertdialog"]'));
async function forceClose() { for (let i = 0; i < 5 && (await dialogOpen()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); } }

/* ============ INITIAL STATE ============ */
await page.goto(`${BASE}/hydration`, { waitUntil: "load" });
await page.waitForTimeout(2600);
const initial = await page.evaluate(() => {
  const hist = document.getElementById("history");
  const rows = [...document.querySelectorAll("#history div.rounded-xl.border")];
  return {
    bodyHas136: /136 oz/.test(document.body.innerText),
    bodyHas8: /(^|\D)8 oz/.test(document.body.innerText),
    historyDayLabels: rows.map((r) => r.textContent.replace(/\s+/g, " ").trim().slice(0, 40)),
    hasHistoryId: !!hist,
  };
});
rec({ step: "hyd-initial", initial });

/* ============ ITEM 2 (hydration): id + link ============ */
const item2 = await page.evaluate(() => {
  const hist = document.getElementById("history");
  const link = [...document.querySelectorAll("a")].find((a) => /Hydration history/i.test(a.textContent));
  const href = link?.getAttribute("href");
  return {
    hasHistoryId: !!hist,
    linkFound: !!link,
    linkHref: href,
    linkResolves: href?.startsWith("#") ? !!document.getElementById(href.slice(1)) : "external",
  };
});
rec({ step: "ITEM2-hyd-anchor", item2 });
let hydScroll = null;
try {
  await page.getByRole("link", { name: /Hydration history/i }).first().click();
  await page.waitForTimeout(900);
  hydScroll = await page.evaluate(() => {
    const r = document.getElementById("history").getBoundingClientRect();
    return { hash: location.hash, scrollY: Math.round(window.scrollY), historyTop: Math.round(r.top), inView: r.top >= 0 && r.top < window.innerHeight };
  });
} catch (e) { hydScroll = { err: String(e).slice(0, 120) }; }
rec({ step: "ITEM2-hyd-scroll", hydScroll });

/* ============ ITEM 3: alignment of the three columns ============ */
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
const item3 = await page.evaluate(() => {
  const round = (r) => ({ left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) });
  // stat tiles container (the grid holding the three KPI cards)
  const tiles = [...document.querySelectorAll("div")].find(
    (d) => d.className.includes("grid") && /Goal streak/.test(d.textContent) && /Best streak/.test(d.textContent) && /Days hit goal/.test(d.textContent)
  );
  // water panel column (parent of the quick-log card)
  const card = document.querySelector('[data-panel-role="quick-log"]');
  const col = card ? card.parentElement : null;
  const section = document.getElementById("history");
  const out = {
    viewport: window.innerWidth,
    tiles: tiles ? round(tiles.getBoundingClientRect()) : null,
    tilesClass: tiles ? tiles.className : null,
    panelCol: col ? round(col.getBoundingClientRect()) : null,
    panelColClass: col ? col.className : null,
    history: section ? round(section.getBoundingClientRect()) : null,
  };
  out.sparse = out.history ? out.history.width < 900 : null;
  const lefts = [out.tiles?.left, out.panelCol?.left, out.history?.left].filter((v) => v != null);
  const rights = [out.tiles?.right, out.panelCol?.right, out.history?.right].filter((v) => v != null);
  out.leftSpread = lefts.length ? Math.max(...lefts) - Math.min(...lefts) : null;
  out.rightSpread = rights.length ? Math.max(...rights) - Math.min(...rights) : null;
  out.aligned = out.leftSpread != null && out.leftSpread <= 4 && out.rightSpread <= 4;
  return out;
});
rec({ step: "ITEM3-alignment", item3 });
await page.screenshot({ path: `${OUT}/03-hydration-alignment.png`, fullPage: true });

/* ============ ITEM 4: water per-entry delete ============ */
await forceClose();
await page.getByRole("button", { name: "Log water" }).first().click();
await page.waitForTimeout(700);
rec({ step: "logwater-open", open: await dialogOpen() });
await page.getByRole("button", { name: /Add a glass of water, 8 ounces/i }).click();
await page.waitForTimeout(1500);
// Let the Undo toast expire WITHOUT clicking it.
rec({ step: "toast-present-after-add", hasUndo: await page.evaluate(() => /Undo/i.test(document.body.innerText)) });
await page.waitForTimeout(7500);
rec({ step: "toast-after-wait", hasUndo: await page.evaluate(() => /Undo/i.test(document.body.innerText)) });

// Reload so the persisted today row renders in History.
await page.goto(`${BASE}/hydration`, { waitUntil: "load" });
await page.waitForTimeout(2600);
await page.screenshot({ path: `${OUT}/04a-hydration-after-add.png`, fullPage: true });

// Expand today's day row (the one totalling 8 oz).
const todayRow = page.locator("#history div.rounded-xl.border").filter({ hasText: "8 oz" }).filter({ hasNotText: "Jul 11" }).first();
const rowCount = await todayRow.count();
rec({ step: "today-row-found", rowCount });
await todayRow.getByRole("button").first().click();
await page.waitForTimeout(800);
const expanded = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("#history div.rounded-xl.border")];
  const row = rows.find((r) => /8 oz/.test(r.textContent) && !/Jul 11/.test(r.textContent));
  if (!row) return { error: "row not found" };
  const li = row.querySelector("ul li");
  const delBtn = row.querySelector("ul li button");
  return {
    expanded: !!row.querySelector("ul"),
    entryText: li ? li.textContent.replace(/\s+/g, " ").trim() : null,
    hasEntryDelete: !!delBtn,
    entryDeleteLabel: delBtn ? delBtn.textContent.trim() : null,
  };
});
rec({ step: "ITEM4-expanded", expanded });
await page.screenshot({ path: `${OUT}/04b-hydration-entry-expanded.png`, fullPage: true });

// Click the individual entry's Delete -> confirmation dialog.
const entryDelete = todayRow.locator("ul li").getByRole("button", { name: "Delete" }).first();
await entryDelete.click();
await page.waitForTimeout(700);
const confirm = await page.evaluate(() => {
  const d = document.querySelector('[role="alertdialog"],[role="dialog"]');
  if (!d) return { present: false };
  const title = d.querySelector("h2,[data-slot='alert-dialog-title']")?.textContent?.trim();
  return { present: true, title, namesAmount: /8 oz/.test(d.textContent), namesEntry: /entry/i.test(d.textContent), full: d.textContent.replace(/\s+/g, " ").trim().slice(0, 200) };
});
rec({ step: "ITEM4-confirm-dialog", confirm });
await page.screenshot({ path: `${OUT}/04c-hydration-delete-confirm.png` });

await page.getByRole("button", { name: /Delete entry/i }).click();
await page.waitForTimeout(3000);

// Reload and verify the entry is gone (today row removed) and Jul 11 preserved.
await page.goto(`${BASE}/hydration`, { waitUntil: "load" });
await page.waitForTimeout(2600);
const after = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("#history div.rounded-xl.border")];
  const labels = rows.map((r) => r.textContent.replace(/\s+/g, " ").trim().slice(0, 40));
  return {
    todayRowPresent: labels.some((l) => !/Jul 11/.test(l)),
    bodyHas136: /136 oz/.test(document.body.innerText),
    historyDayLabels: labels,
  };
});
rec({ step: "ITEM4-after-delete", after });
await page.screenshot({ path: `${OUT}/04d-hydration-after-delete.png`, fullPage: true });

writeFileSync(`${OUT}/hydration.json`, JSON.stringify(log, null, 2));
console.log("=== HYDRATION DONE ===");
await ctx.close();
await browser.close();
