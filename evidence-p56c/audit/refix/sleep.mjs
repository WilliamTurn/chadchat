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
async function forceClose() {
  for (let i = 0; i < 5 && (await dialogOpen()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
}

/* ============ INITIAL STATE ============ */
await page.goto(`${BASE}/sleep`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const initial = await page.evaluate(() => {
  const rows = document.querySelectorAll('#history .rounded-xl.border');
  return {
    bodyEmpty: /No sleep logged yet/.test(document.body.innerText),
    historyRowCount: rows.length,
    hasHistoryId: !!document.getElementById("history"),
  };
});
rec({ step: "sleep-initial", initial });

/* ============ ITEM 1: log ONE past night ============ */
// Open the create overlay from the panel (empty-state or footer "Log last night").
await forceClose();
await page.getByRole("button", { name: "Log last night" }).first().click();
await page.waitForTimeout(700);
rec({ step: "logdialog-open", open: await dialogOpen() });

// Pick an unlogged recent past date via the DatePicker popover -> July 8, 2026.
await page.locator("#sleep-log-night").click();
await page.waitForTimeout(600);
let datePicked = false;
try {
  const cell = page.locator('[data-day="2026-07-08"]').first();
  const btn = cell.locator("button");
  await (await btn.count() ? btn.first() : cell).click();
  await page.waitForTimeout(600);
  datePicked = true;
} catch (e) {
  rec({ step: "datepick-error", err: String(e).slice(0, 140) });
}
// ensure the popover is closed before we reach the submit button
for (let i = 0; i < 3; i++) {
  const popOpen = await page.locator("[data-radix-popper-content-wrapper]").count();
  if (!popOpen) break;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}
const triggerText = await page.locator("#sleep-log-night").innerText().catch(() => null);
rec({ step: "date-picked", datePicked, triggerText });

// Submit with the default 7h 30m.
await page.getByRole("button", { name: /^Log sleep$/i }).click();
await page.waitForTimeout(3000);

// Reload to render the persisted single-night sparse layout.
await page.goto(`${BASE}/sleep`, { waitUntil: "load" });
await page.waitForTimeout(2500);

const item1 = await page.evaluate(() => {
  const section = document.getElementById("history");
  if (!section) return { error: "no #history" };
  const sRect = section.getBoundingClientRect();
  // The single row is the bordered card inside the history grid.
  const grid = section.querySelector("div.grid") || section;
  const gRect = grid.getBoundingClientRect();
  const row = grid.querySelector(":scope > div");
  const rRect = row ? row.getBoundingClientRect() : null;
  const dateDiv = row ? row.querySelector(".font-medium.text-sm") : null;
  const dRect = dateDiv ? dateDiv.getBoundingClientRect() : null;
  const lineH = dateDiv ? parseFloat(getComputedStyle(dateDiv).lineHeight) : null;
  const buttons = row ? [...row.querySelectorAll("button")] : [];
  const btnInfo = buttons.map((b) => {
    const r = b.getBoundingClientRect();
    return { label: b.textContent.trim(), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  // overlap check between the two action buttons
  let overlap = null;
  if (btnInfo.length >= 2) {
    const [a, b] = btnInfo;
    overlap = !(a.right <= b.left + 1 || b.right <= a.left + 1);
  }
  return {
    rowCount: grid.querySelectorAll(":scope > div").length,
    section: { left: Math.round(sRect.left), right: Math.round(sRect.right), width: Math.round(sRect.width) },
    grid: { left: Math.round(gRect.left), right: Math.round(gRect.right), width: Math.round(gRect.width) },
    row: rRect ? { left: Math.round(rRect.left), right: Math.round(rRect.right), width: Math.round(rRect.width) } : null,
    rowWidthRatio: rRect && gRect.width ? +(rRect.width / gRect.width).toFixed(3) : null,
    dateText: dateDiv ? dateDiv.textContent.replace(/\s+/g, " ").trim() : null,
    dateHeight: dRect ? Math.round(dRect.height) : null,
    dateLineHeight: lineH,
    dateOnOneLine: dRect && lineH ? dRect.height <= lineH * 1.6 : null,
    buttons: btnInfo,
    buttonsOverlap: overlap,
  };
});
rec({ step: "ITEM1-single-night-layout", item1 });
await page.screenshot({ path: `${OUT}/01-sleep-single-night.png`, fullPage: true });

/* ============ delete that night (cleanup) ============ */
let sleepDeleted = false;
await forceClose();
const delBtn = page.locator("#history").getByRole("button", { name: "Delete" }).first();
if (await delBtn.count()) {
  await delBtn.click();
  await page.waitForTimeout(600);
  const confirm = await page.evaluate(() => {
    const d = document.querySelector('[role="alertdialog"],[role="dialog"]');
    return d ? { present: true, title: d.querySelector("h2,[data-slot='alert-dialog-title']")?.textContent?.trim() || d.textContent.slice(0, 120) } : { present: false };
  });
  rec({ step: "sleep-delete-confirm", confirm });
  await page.getByRole("button", { name: /Delete night/i }).click();
  await page.waitForTimeout(3000);
  sleepDeleted = true;
}
rec({ step: "sleep-deleted", sleepDeleted });

/* ============ ITEM 2 (sleep): empty-state anchors ============ */
await page.goto(`${BASE}/sleep`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const item2sleep = await page.evaluate(() => {
  const hist = document.getElementById("history");
  const link = [...document.querySelectorAll("a")].find((a) => /Night history/i.test(a.textContent));
  const href = link?.getAttribute("href");
  const emptyCopy = hist ? hist.textContent.replace(/\s+/g, " ").trim() : null;
  return {
    hasHistoryId: !!hist,
    emptyCopy: emptyCopy ? emptyCopy.slice(0, 160) : null,
    designedEmpty: hist ? /No nights logged yet/.test(hist.textContent) : false,
    linkFound: !!link,
    linkHref: href,
    linkResolves: href?.startsWith("#") ? !!document.getElementById(href.slice(1)) : "external",
  };
});
rec({ step: "ITEM2-sleep-anchors", item2sleep });

// Click the "Night history" link and confirm the anchor scrolls into view.
let sleepScroll = null;
try {
  const before = await page.evaluate(() => window.scrollY);
  await page.getByRole("link", { name: /Night history/i }).first().click();
  await page.waitForTimeout(900);
  sleepScroll = await page.evaluate(() => {
    const hist = document.getElementById("history");
    const r = hist.getBoundingClientRect();
    return { hash: location.hash, scrollY: Math.round(window.scrollY), historyTop: Math.round(r.top), inView: r.top >= 0 && r.top < window.innerHeight };
  });
  sleepScroll.scrolledFrom = before;
} catch (e) { sleepScroll = { err: String(e).slice(0, 120) }; }
rec({ step: "ITEM2-sleep-scroll", sleepScroll });
await page.screenshot({ path: `${OUT}/02-sleep-empty-anchor.png`, fullPage: true });

writeFileSync(`${OUT}/sleep.json`, JSON.stringify(log, null, 2));
console.log("=== SLEEP DONE ===");
await ctx.close();
await browser.close();
