import { makeBrowser, ctxFor, BASE, OUT } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const { browser, authCookies } = await makeBrowser();
const log = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };

// Real touch/mobile context (mobile-first gate): drawer sheet path in AdaptiveDialog.
const ctx = await ctxFor(browser, authCookies, { width: 390, height: 844 }, "dark", { hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") rec({ consoleError: m.text().slice(0, 160) }); });

const overflowInfo = () => page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
}));
async function sheetInfo(tag) {
  return await page.evaluate((tag) => {
    const d = document.querySelector('[data-slot="drawer-content"], [role="dialog"], [vaul-drawer]');
    if (!d) return { tag, present: false };
    const r = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    const bg = cs.backgroundColor; const m = bg.match(/rgba?\(([^)]+)\)/); const alpha = m ? (m[1].split(",")[3] != null ? parseFloat(m[1].split(",")[3]) : 1) : 1;
    const ae = document.activeElement;
    return {
      tag, present: true,
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) },
      vh: window.innerHeight, vw: window.innerWidth,
      inViewport: r.bottom <= window.innerHeight + 2 && r.left >= -2 && r.right <= window.innerWidth + 2,
      bg, bgAlpha: alpha,
      title: d.querySelector("[data-slot='drawer-title'],h1,h2")?.textContent?.trim() || null,
      activeEl: ae ? ae.tagName : null,
      activeIsInput: ae ? ["INPUT", "TEXTAREA"].includes(ae.tagName) : false,
    };
  }, tag);
}
const open = () => page.evaluate(() => !!document.querySelector('[data-slot="drawer-content"],[role="dialog"]'));
async function forceClose() { for (let i = 0; i < 4 && (await open()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(400); } }

for (const [path, name, primary] of [["/hydration", "hydration", "Log water"], ["/sleep", "sleep", "Log last night"]]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  rec({ step: `${name}-390-load`, ...(await overflowInfo()) });
  await page.screenshot({ path: `${OUT}/MOB-${name}-page.png`, fullPage: true });

  // open primary via tap
  await forceClose();
  const btn = page.getByRole("button", { name: primary, exact: true }).first();
  if (await btn.count()) {
    await btn.tap();
    await page.waitForTimeout(700);
    rec({ step: `${name}-390-primary-open`, ...(await sheetInfo(name)) });
    await page.screenshot({ path: `${OUT}/MOB-${name}-sheet.png` });
    // overflow while sheet open
    rec({ step: `${name}-390-overflow-while-open`, ...(await overflowInfo()) });
    // close via Escape
    await page.keyboard.press("Escape"); await page.waitForTimeout(500);
    rec({ step: `${name}-390-escape`, open: await open() });
    await forceClose();
  } else {
    rec({ step: `${name}-390-primary-open`, ERROR: "primary button not found" });
  }
}

// Log water on mobile (tap a serving) -> verify optimistic + Today's log, then delete cleanup
await page.goto(`${BASE}/hydration`, { waitUntil: "load" }); await page.waitForTimeout(2200);
await forceClose();
await page.getByRole("button", { name: "Log water", exact: true }).first().tap();
await page.waitForTimeout(700);
const servBtn = page.getByRole("button", { name: /Add a glass of water, 8 ounces/i });
if (await servBtn.count()) {
  await servBtn.tap();
  await page.waitForTimeout(2800);
  rec({ step: "mob-hyd-after-log", bodyHas8oz: await page.evaluate(() => /8 oz/.test(document.body.innerText)), ...(await overflowInfo()) });
  await page.screenshot({ path: `${OUT}/MOB-hydration-after-log.png`, fullPage: true });
  // cleanup
  const del = page.locator("section", { hasText: "Today's log" }).getByRole("button", { name: "Delete" }).first();
  if (await del.count()) {
    await del.tap(); await page.waitForTimeout(600);
    rec({ step: "mob-hyd-delete-confirm", ...(await sheetInfo("mob-del")) });
    await page.screenshot({ path: `${OUT}/MOB-hydration-delete-confirm.png` });
    const conf = page.getByRole("button", { name: /Delete entry/i });
    if (await conf.count()) { await conf.tap(); await page.waitForTimeout(2800); }
  }
  rec({ step: "mob-hyd-after-cleanup", bodyHas8oz: await page.evaluate(() => /8 oz/.test(document.body.innerText)) });
}

writeFileSync(`${OUT}/mobile.json`, JSON.stringify(log, null, 2));
console.log("=== MOBILE DONE ===");
await ctx.close();
await browser.close();
