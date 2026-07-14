import { makeBrowser, ctxFor, BASE, OUT } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const { browser, authCookies } = await makeBrowser();
const log = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };
const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 900 }, "dark");
const page = await ctx.newPage();

const bodyPE = () => page.evaluate(() => ({
  bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
  htmlPointerEvents: getComputedStyle(document.documentElement).pointerEvents,
  moreOptionsVisible: (() => { const b = [...document.querySelectorAll("button")].find((x) => /More options/i.test(x.getAttribute("aria-label") || "")); if (!b) return "absent"; const r = b.getBoundingClientRect(); return `present ${Math.round(r.width)}x${Math.round(r.height)} pe=${getComputedStyle(b).pointerEvents}`; })(),
}));

await page.goto(`${BASE}/hydration`, { waitUntil: "load" });
await page.waitForTimeout(2500);
rec({ step: "baseline", ...(await bodyPE()) });

// 1) open + Escape
await page.getByRole("button", { name: "Log water", exact: true }).first().click();
await page.waitForTimeout(600);
await page.keyboard.press("Escape");
await page.waitForTimeout(800);
rec({ step: "after-escape", ...(await bodyPE()) });
// try clicking More options with a short timeout
try {
  await page.getByRole("button", { name: "More options" }).first().click({ timeout: 4000 });
  await page.waitForTimeout(400);
  const menuOpen = await page.evaluate(() => !!document.querySelector('[role="menu"]'));
  rec({ step: "after-escape-clicked-moreoptions", ok: true, menuOpen });
  await page.keyboard.press("Escape");
} catch (e) { rec({ step: "after-escape-clicked-moreoptions", ok: false, err: String(e).slice(0, 100) }); }

// 2) open + backdrop click
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Log water", exact: true }).first().click();
await page.waitForTimeout(600);
await page.mouse.click(6, 6);
await page.waitForTimeout(800);
rec({ step: "after-backdrop", ...(await bodyPE()) });
try {
  await page.getByRole("button", { name: "More options" }).first().click({ timeout: 4000 });
  await page.waitForTimeout(400);
  const menuOpen = await page.evaluate(() => !!document.querySelector('[role="menu"]'));
  rec({ step: "after-backdrop-clicked-moreoptions", ok: true, menuOpen });
} catch (e) { rec({ step: "after-backdrop-clicked-moreoptions", ok: false, err: String(e).slice(0, 100) }); }

// 3) fresh reload, click More options directly (no prior dialog)
await page.goto(`${BASE}/hydration`, { waitUntil: "load" });
await page.waitForTimeout(2500);
try {
  await page.getByRole("button", { name: "More options" }).first().click({ timeout: 6000 });
  await page.waitForTimeout(400);
  const items = await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent.trim()));
  rec({ step: "fresh-moreoptions", ok: true, items });
  // open Edit daily goal then check confirm/close
  await page.getByRole("menuitem", { name: /Edit daily goal/i }).click();
  await page.waitForTimeout(600);
  rec({ step: "fresh-editgoal", open: await page.evaluate(() => !!document.querySelector('[role="dialog"]')) });
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  rec({ step: "fresh-editgoal-after-escape", ...(await bodyPE()) });
} catch (e) { rec({ step: "fresh-moreoptions", ok: false, err: String(e).slice(0, 120) }); }

// 4) confirm dialog buttons (log water, delete, inspect alertdialog buttons)
await page.getByRole("button", { name: "Log water", exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Add a glass of water, 8 ounces/i }).click();
await page.waitForTimeout(2800);
const delBtn = page.locator("section", { hasText: "Today's log" }).getByRole("button", { name: "Delete" }).first();
if (await delBtn.count()) {
  await delBtn.click(); await page.waitForTimeout(600);
  const confInfo = await page.evaluate(() => {
    const d = document.querySelector('[role="alertdialog"],[role="dialog"]');
    if (!d) return { present: false };
    return { present: true, buttons: [...d.querySelectorAll("button")].map((b) => b.textContent.trim()), title: d.querySelector("h1,h2")?.textContent?.trim() };
  });
  rec({ step: "confirm-dialog-buttons", confInfo });
  // cancel path: press Escape, verify entry still there
  await page.keyboard.press("Escape"); await page.waitForTimeout(600);
  rec({ step: "confirm-cancel-keeps-entry", stillThere: await page.evaluate(() => /8 oz/.test(document.body.innerText)), ...(await bodyPE()) });
  // now actually delete to clean up
  await delBtn.click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Delete entry/i }).click(); await page.waitForTimeout(2800);
  rec({ step: "cleanup-final", bodyHas8oz: await page.evaluate(() => /8 oz/.test(document.body.innerText)) });
}

writeFileSync(`${OUT}/pointerprobe.json`, JSON.stringify(log, null, 2));
console.log("=== POINTERPROBE DONE ===");
await ctx.close();
await browser.close();
