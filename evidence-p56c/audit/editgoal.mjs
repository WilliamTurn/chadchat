import { makeBrowser, ctxFor, BASE, OUT } from "./_lib.mjs";
import { writeFileSync } from "node:fs";
const { browser, authCookies } = await makeBrowser();
const log = []; const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };
const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 900 }, "dark");
const page = await ctx.newPage();
async function dlg(tag) {
  return await page.evaluate((tag) => {
    const d = document.querySelector('[role="dialog"],[role="alertdialog"]'); if (!d) return { tag, present: false };
    const r = d.getBoundingClientRect(); const cs = getComputedStyle(d); const bg = cs.backgroundColor; const m = bg.match(/rgba?\(([^)]+)\)/); const a = m && m[1].split(",")[3] != null ? parseFloat(m[1].split(",")[3]) : 1;
    const ae = document.activeElement;
    return { tag, present: true, title: d.querySelector("h1,h2,[data-slot='dialog-title']")?.textContent?.trim(), inViewport: r.top >= -1 && r.bottom <= innerHeight + 1, bgAlpha: a, activeIsInput: ["INPUT", "TEXTAREA"].includes(ae?.tagName), presets: [...d.querySelectorAll("button")].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 10) };
  }, tag);
}
const open = () => page.evaluate(() => !!document.querySelector('[role="dialog"],[role="alertdialog"]'));
async function forceClose() { for (let i = 0; i < 4 && (await open()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); } }

/* HYDRATION: log a glass so the footer/overflow renders, open Edit daily goal */
await page.goto(`${BASE}/hydration`, { waitUntil: "load" }); await page.waitForTimeout(2200);
await page.getByRole("button", { name: "Log water", exact: true }).first().click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: /Add a glass of water, 8 ounces/i }).click(); await page.waitForTimeout(2600);
await forceClose();
await page.getByRole("button", { name: "More options" }).first().click(); await page.waitForTimeout(400);
await page.getByRole("menuitem", { name: /Edit daily goal/i }).click(); await page.waitForTimeout(600);
rec({ step: "edit-daily-goal", ...(await dlg("water-goal")) });
await page.screenshot({ path: `${OUT}/EDIT-water-goal.png` });
await forceClose();
// cleanup water
const wdel = page.locator("section", { hasText: "Today's log" }).getByRole("button", { name: "Delete" }).first();
if (await wdel.count()) { await wdel.click(); await page.waitForTimeout(500); const c = page.getByRole("button", { name: /Delete entry/i }); if (await c.count()) { await c.click(); await page.waitForTimeout(2500); } }
rec({ step: "water-clean", has8oz: await page.evaluate(() => /8 oz/.test(document.body.innerText)), todayLog: !!(await page.locator("section", { hasText: "Today's log" }).count()) });

/* SLEEP: log a night so overflow renders, open Edit nightly goal */
await page.goto(`${BASE}/sleep`, { waitUntil: "load" }); await page.waitForTimeout(2200);
await page.getByRole("button", { name: "Log last night", exact: true }).first().click(); await page.waitForTimeout(600);
await page.getByRole("button", { name: /^Log sleep$/i }).click(); await page.waitForTimeout(2600);
await forceClose();
await page.getByRole("button", { name: "More options" }).first().click(); await page.waitForTimeout(400);
const items = await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent.trim()));
rec({ step: "sleep-overflow-items", items });
await page.getByRole("menuitem", { name: /Edit nightly goal/i }).click(); await page.waitForTimeout(600);
rec({ step: "edit-nightly-goal", ...(await dlg("sleep-goal")) });
await page.screenshot({ path: `${OUT}/EDIT-sleep-goal.png` });
await forceClose();
// cleanup sleep
const sdel = page.locator("#history").getByRole("button", { name: "Delete" }).first();
if (await sdel.count()) { await sdel.click(); await page.waitForTimeout(500); const c = page.getByRole("button", { name: /Delete night/i }); if (await c.count()) { await c.click(); await page.waitForTimeout(2600); } }
rec({ step: "sleep-clean", empty: await page.evaluate(() => /No sleep logged yet/.test(document.body.innerText)), history: !!(await page.locator("#history").count()) });

writeFileSync(`${OUT}/editgoal.json`, JSON.stringify(log, null, 2));
console.log("=== EDITGOAL DONE ===");
await ctx.close(); await browser.close();
