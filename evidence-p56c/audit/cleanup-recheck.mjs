import { makeBrowser, ctxFor, BASE, OUT } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const { browser, authCookies } = await makeBrowser();
const log = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };

/* ---- STEP 1: DESKTOP cleanup of any stray water entries ---- */
const dctx = await ctxFor(browser, authCookies, { width: 1440, height: 900 }, "dark");
const dp = await dctx.newPage();
await dp.goto(`${BASE}/hydration`, { waitUntil: "load" }); await dp.waitForTimeout(2500);
let guard = 0;
while ((await dp.locator("section", { hasText: "Today's log" }).count()) && guard < 8) {
  guard++;
  const del = dp.locator("section", { hasText: "Today's log" }).getByRole("button", { name: "Delete" }).first();
  if (!(await del.count())) break;
  await del.click(); await dp.waitForTimeout(500);
  const conf = dp.getByRole("button", { name: /Delete entry/i });
  if (await conf.count()) { await conf.click(); await dp.waitForTimeout(2500); } else break;
}
rec({ step: "cleanup-water", iterations: guard, bodyHas8oz: await dp.evaluate(() => /8 oz/.test(document.body.innerText)), todayLogPresent: !!(await dp.locator("section", { hasText: "Today's log" }).count()) });
// also verify no stray sleep entry
await dp.goto(`${BASE}/sleep`, { waitUntil: "load" }); await dp.waitForTimeout(2000);
let sguard = 0;
while ((await dp.locator("#history").count()) && sguard < 8) {
  sguard++;
  const del = dp.locator("#history").getByRole("button", { name: "Delete" }).first();
  if (!(await del.count())) break;
  await del.click(); await dp.waitForTimeout(500);
  const conf = dp.getByRole("button", { name: /Delete night/i });
  if (await conf.count()) { await conf.click(); await dp.waitForTimeout(2500); } else break;
}
rec({ step: "cleanup-sleep", iterations: sguard, historyPresent: !!(await dp.locator("#history").count()), bodyEmpty: await dp.evaluate(() => /No sleep logged yet/.test(document.body.innerText)) });
await dctx.close();

/* ---- STEP 2: MOBILE re-checks (touch) ---- */
const ctx = await ctxFor(browser, authCookies, { width: 390, height: 844 }, "dark", { hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const open = () => page.evaluate(() => !!document.querySelector('[data-slot="drawer-content"],[role="dialog"],[role="alertdialog"]'));
async function forceClose() { for (let i = 0; i < 5 && (await open()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(400); } }

// 2a. Sleep drawer close: Escape (retry with longer settle), then X, then backdrop
await page.goto(`${BASE}/sleep`, { waitUntil: "load" }); await page.waitForTimeout(2500);
async function openSleep() { await page.getByRole("button", { name: "Log last night", exact: true }).first().tap(); await page.waitForTimeout(900); }
await openSleep();
await page.waitForTimeout(400);
await page.keyboard.press("Escape"); await page.waitForTimeout(900);
rec({ step: "mob-sleep-escape-retry", stillOpen: await open() });
await forceClose();
await openSleep();
const xbtn = page.getByRole("button", { name: "Close" }).first();
const hadX = await xbtn.count();
if (hadX) await xbtn.tap(); await page.waitForTimeout(700);
rec({ step: "mob-sleep-X", hadX: !!hadX, stillOpen: await open() });
await forceClose();
await openSleep();
// backdrop tap near very top center (drawer bottom-anchored; top area is overlay)
await page.mouse.click(195, 30); await page.waitForTimeout(800);
rec({ step: "mob-sleep-backdrop", stillOpen: await open() });
await forceClose();

// also re-check hydration drawer close via X + backdrop for parity
await page.goto(`${BASE}/hydration`, { waitUntil: "load" }); await page.waitForTimeout(2200);
async function openWater() { await page.getByRole("button", { name: "Log water", exact: true }).first().tap(); await page.waitForTimeout(900); }
await openWater();
const hx = page.getByRole("button", { name: "Close" }).first(); const hadHX = await hx.count();
if (hadHX) await hx.tap(); await page.waitForTimeout(700);
rec({ step: "mob-hyd-X", hadX: !!hadHX, stillOpen: await open() });
await forceClose();
await openWater();
await page.mouse.click(195, 30); await page.waitForTimeout(800);
rec({ step: "mob-hyd-backdrop", stillOpen: await open() });
await forceClose();

// 2b. Mobile delete-confirm: log a glass, delete via alertdialog, verify + CLEAN UP
await openWater();
const serv = page.getByRole("button", { name: /Add a glass of water, 8 ounces/i });
if (await serv.count()) { await serv.tap(); await page.waitForTimeout(2800); }
rec({ step: "mob-hyd-relog", bodyHas8oz: await page.evaluate(() => /8 oz/.test(document.body.innerText)) });
const del = page.locator("section", { hasText: "Today's log" }).getByRole("button", { name: "Delete" }).first();
if (await del.count()) {
  await del.tap(); await page.waitForTimeout(800);
  const confInfo = await page.evaluate(() => {
    const d = document.querySelector('[role="alertdialog"],[role="dialog"]');
    if (!d) return { present: false };
    const r = d.getBoundingClientRect();
    return { present: true, role: d.getAttribute("role"), title: d.querySelector("h1,h2,[data-slot='alert-dialog-title']")?.textContent?.trim(), buttons: [...d.querySelectorAll("button")].map((b) => b.textContent.trim()), inViewport: r.top >= -2 && r.bottom <= window.innerHeight + 2, w: Math.round(r.width) };
  });
  rec({ step: "mob-hyd-delete-confirm", confInfo });
  await page.screenshot({ path: `${OUT}/MOB-hyd-delete-confirm.png` });
  const conf = page.getByRole("button", { name: /Delete entry/i });
  if (await conf.count()) { await conf.tap(); await page.waitForTimeout(2800); }
}
rec({ step: "mob-hyd-final-clean", bodyHas8oz: await page.evaluate(() => /8 oz/.test(document.body.innerText)), todayLogPresent: !!(await page.locator("section", { hasText: "Today's log" }).count()) });

// FINAL desktop verification of clean DB
const fctx = await ctxFor(browser, authCookies, { width: 1200, height: 900 }, "dark");
const fp = await fctx.newPage();
await fp.goto(`${BASE}/hydration`, { waitUntil: "load" }); await fp.waitForTimeout(2000);
const finalHyd = { todayLog: !!(await fp.locator("section", { hasText: "Today's log" }).count()), has8oz: await fp.evaluate(() => /8 oz/.test(document.body.innerText)) };
await fp.goto(`${BASE}/sleep`, { waitUntil: "load" }); await fp.waitForTimeout(2000);
const finalSleep = { history: !!(await fp.locator("#history").count()), empty: await fp.evaluate(() => /No sleep logged yet/.test(document.body.innerText)) };
rec({ step: "FINAL-DB-STATE", finalHyd, finalSleep });
await fctx.close();

writeFileSync(`${OUT}/cleanup-recheck.json`, JSON.stringify(log, null, 2));
console.log("=== CLEANUP+RECHECK DONE ===");
await ctx.close();
await browser.close();
