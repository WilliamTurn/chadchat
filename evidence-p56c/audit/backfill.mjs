import { makeBrowser, ctxFor, BASE, OUT } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const { browser, authCookies } = await makeBrowser();
const log = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };
const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 900 }, "dark");
const page = await ctx.newPage();

/* ---- WATER BACKFILL to yesterday, then UNDO to clean ---- */
await page.goto(`${BASE}/hydration`, { waitUntil: "load" }); await page.waitForTimeout(2500);
// confirm WaterHistory has no edit/delete controls
const histControls = await page.evaluate(() => {
  const h = document.getElementById("history");
  if (!h) return { present: false };
  const btns = [...h.querySelectorAll("button")].map((b) => b.textContent.trim());
  return { present: true, buttons: btns, heading: h.querySelector("h2")?.textContent?.trim() };
});
rec({ step: "water-history-controls", histControls });

const beforeDays = await page.evaluate(() => {
  const h = document.getElementById("history");
  return h ? [...h.querySelectorAll("div > span:first-child")].map((s) => s.textContent.trim()).filter(Boolean) : [];
});
// backfill card defaults Day = yesterday; pick 20 oz preset, add
const card = page.locator("#log-past-day");
const dayLabel = await card.locator("button#water-backfill-date, #water-backfill-date").first().textContent().catch(() => null);
await card.getByRole("button", { name: "20 oz" }).click();
await page.waitForTimeout(300);
await card.getByRole("button", { name: /Add water/i }).click();
await page.waitForTimeout(2500);
const afterAdd = await page.evaluate(() => {
  const h = document.getElementById("history");
  const rows = h ? [...h.querySelectorAll(":scope > div > div")].map((r) => r.textContent.replace(/\s+/g, " ").trim()) : [];
  const toastText = [...document.querySelectorAll("[data-sonner-toast], li")].map((t) => t.textContent.replace(/\s+/g, " ").trim()).filter((t) => /Added|oz/.test(t)).slice(0, 3);
  return { historyRows: rows.slice(0, 6), toastText };
});
rec({ step: "water-backfill-added", dayField: dayLabel?.trim(), afterAdd });
await page.screenshot({ path: `${OUT}/water-backfill-added.png`, fullPage: true });
// UNDO via toast
const undo = page.getByRole("button", { name: /^Undo$/i }).first();
const hadUndo = await undo.count();
if (hadUndo) { await undo.click(); await page.waitForTimeout(2500); }
const afterUndo = await page.evaluate(() => {
  const h = document.getElementById("history");
  return { rows: h ? [...h.querySelectorAll(":scope > div > div")].map((r) => r.textContent.replace(/\s+/g, " ").trim()).slice(0, 6) : [] };
});
rec({ step: "water-backfill-undo", hadUndo: !!hadUndo, afterUndo });

/* ---- SLEEP BACKFILL to a past night via the calendar, then DELETE ---- */
await page.goto(`${BASE}/sleep`, { waitUntil: "load" }); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Log last night", exact: true }).first().click();
await page.waitForTimeout(700);
// open the date field (calendar popover) and pick a day earlier in the visible month
const dateTrigger = page.locator("#sleep-log-night");
const beforePick = await dateTrigger.textContent().catch(() => null);
await dateTrigger.click();
await page.waitForTimeout(700);
// pick a specific earlier day: click a day button that is enabled and not today
const picked = await page.evaluate(() => {
  const grid = document.querySelector('[role="dialog"] [role="grid"], [role="grid"]');
  if (!grid) return { ok: false, reason: "no grid" };
  const days = [...grid.querySelectorAll('button:not([disabled])')].filter((b) => /^\d+$/.test(b.textContent.trim()));
  // pick the 8th of the month if present else the earliest enabled
  const target = days.find((b) => b.textContent.trim() === "8") || days[0];
  if (!target) return { ok: false, reason: "no day" };
  target.setAttribute("data-picktarget", "1");
  return { ok: true, day: target.textContent.trim() };
});
if (picked.ok) { await page.locator('[data-picktarget="1"]').click(); await page.waitForTimeout(600); }
const afterPick = await page.locator("#sleep-log-night").textContent().catch(() => null);
rec({ step: "sleep-date-pick", picked, before: beforePick?.trim(), after: afterPick?.trim() });
// submit
await page.getByRole("button", { name: /^Log sleep$/i }).click();
await page.waitForTimeout(2800);
const sleepAfter = await page.evaluate(() => {
  const h = document.getElementById("history");
  const rows = h ? [...h.querySelectorAll(":scope > div > div")].map((r) => r.textContent.replace(/\s+/g, " ").trim()) : [];
  // week strip labels that are filled
  const strip = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute("aria-label")).filter((l) => /logged|hours|goal met/i.test(l || "")).slice(0, 10);
  return { historyRows: rows.slice(0, 6), hasHistory: !!h };
});
rec({ step: "sleep-backfill-added", sleepAfter });
await page.screenshot({ path: `${OUT}/sleep-backfill-added.png`, fullPage: true });
// DELETE via History (named confirm) to clean up
if (sleepAfter.hasHistory) {
  const del = page.locator("#history").getByRole("button", { name: "Delete" }).first();
  if (await del.count()) {
    await del.click(); await page.waitForTimeout(600);
    const confTitle = await page.evaluate(() => document.querySelector('[role="alertdialog"] h2, [role="alertdialog"] [data-slot="alert-dialog-title"]')?.textContent?.trim() || null);
    rec({ step: "sleep-backfill-delete-confirm-title", confTitle });
    const conf = page.getByRole("button", { name: /Delete night/i });
    if (await conf.count()) { await conf.click(); await page.waitForTimeout(2800); }
  }
}
// FINAL clean verify
await page.goto(`${BASE}/sleep`, { waitUntil: "load" }); await page.waitForTimeout(1800);
const sc = { history: !!(await page.locator("#history").count()), empty: await page.evaluate(() => /No sleep logged yet/.test(document.body.innerText)) };
await page.goto(`${BASE}/hydration`, { waitUntil: "load" }); await page.waitForTimeout(1800);
const wc = await page.evaluate(() => {
  const h = document.getElementById("history");
  return { rows: h ? [...h.querySelectorAll(":scope > div > div")].map((r) => r.textContent.replace(/\s+/g, " ").trim()).slice(0, 6) : [] };
});
rec({ step: "FINAL-CLEAN", sleep: sc, waterHistory: wc });

writeFileSync(`${OUT}/backfill.json`, JSON.stringify(log, null, 2));
console.log("=== BACKFILL DONE ===");
await ctx.close();
await browser.close();
