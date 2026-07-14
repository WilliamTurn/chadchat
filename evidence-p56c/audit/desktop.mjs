import { makeBrowser, ctxFor, BASE, OUT } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const { browser, authCookies } = await makeBrowser();
const log = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };

const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 900 }, "dark");
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") rec({ consoleError: m.text().slice(0, 220) }); });

async function dialogInfo(tag) {
  return await page.evaluate((tag) => {
    const d = document.querySelector('[role="dialog"], [role="alertdialog"]');
    if (!d) return { tag, present: false };
    const r = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    const bg = cs.backgroundColor;
    const alpha = (() => { const m = bg.match(/rgba?\(([^)]+)\)/); if (!m) return 1; const p = m[1].split(","); return p[3] != null ? parseFloat(p[3]) : 1; })();
    const ae = document.activeElement;
    const closeBtn = [...d.querySelectorAll("button")].find((b) => /close/i.test(b.textContent) || /close/i.test(b.getAttribute("aria-label") || ""));
    return {
      tag, present: true,
      inViewport: r.top >= -1 && r.left >= -1 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1,
      rect: { top: Math.round(r.top), left: Math.round(r.left), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) },
      vh: window.innerHeight,
      bg, bgAlpha: alpha,
      title: d.querySelector("h1,h2,[data-slot='dialog-title'],[data-slot='drawer-title']")?.textContent?.trim() || null,
      activeEl: ae ? ae.tagName : null,
      activeIsInput: ae ? ["INPUT", "TEXTAREA"].includes(ae.tagName) : false,
      hasCloseBtn: !!closeBtn,
    };
  }, tag);
}
const dialogOpen = () => page.evaluate(() => !!document.querySelector('[role="dialog"],[role="alertdialog"]'));
async function forceClose() {
  for (let i = 0; i < 4 && (await dialogOpen()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(350); }
}
async function openByName(name) {
  await forceClose();
  await page.getByRole("button", { name, exact: true }).first().click();
  await page.waitForTimeout(600);
}
async function safe(label, fn) { try { await fn(); } catch (e) { rec({ step: label, ERROR: String(e).slice(0, 160) }); await forceClose(); } }

/* ============================ /HYDRATION ============================ */
await page.goto(`${BASE}/hydration`, { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/hyd-desktop-empty.png`, fullPage: true });

// three-way close sweep on Log water
await safe("hyd-logwater-sweep", async () => {
  await openByName("Log water");
  rec({ step: "hyd-logwater-open-top", ...(await dialogInfo("logwater-top")) });
  await page.screenshot({ path: `${OUT}/hyd-logwater-open.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  rec({ step: "hyd-logwater-escape", open: await dialogOpen() });
  await openByName("Log water");
  const closeBtn = page.getByRole("button", { name: "Close" }).first();
  const hadClose = await closeBtn.count();
  if (hadClose) await closeBtn.click();
  await page.waitForTimeout(400);
  rec({ step: "hyd-logwater-X", hadClose: !!hadClose, open: await dialogOpen() });
  await openByName("Log water");
  await page.mouse.click(6, 6); await page.waitForTimeout(400);
  rec({ step: "hyd-logwater-backdrop", open: await dialogOpen() });
  await forceClose();
});

// Edit daily goal overlay
await safe("hyd-editgoal", async () => {
  await forceClose();
  await page.getByRole("button", { name: "More options" }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("menuitem", { name: /Edit daily goal/i }).click();
  await page.waitForTimeout(600);
  rec({ step: "hyd-editgoal-open", ...(await dialogInfo("editgoal")) });
  await page.screenshot({ path: `${OUT}/hyd-editgoal-open.png` });
  await forceClose();
});

// AFTER-ACTION: log a glass
await safe("hyd-after-log", async () => {
  await openByName("Log water");
  await page.getByRole("button", { name: /Add a glass of water, 8 ounces/i }).click();
  await page.waitForTimeout(2800);
  const afterLog = await page.evaluate(() => {
    const s = [...document.querySelectorAll("section")].find((x) => /Today's log/i.test(x.textContent));
    return {
      hasTodayLog: !!s,
      todayLogText: s ? s.textContent.replace(/\s+/g, " ").trim().slice(0, 160) : null,
      bodyHas8oz: /8 oz/.test(document.body.innerText),
      goalStreak: (document.body.innerText.match(/Goal streak\s*(\d+)/) || [])[0] || null,
      panelSnippet: (document.body.innerText.match(/WATER[\s\S]{0,80}/) || [])[0]?.replace(/\s+/g, " ") || null,
    };
  });
  rec({ step: "hyd-after-log-glass", afterLog });
  await page.screenshot({ path: `${OUT}/hyd-after-log.png`, fullPage: true });
});

// CROSS-SURFACE: /today reflects it via soft nav
await safe("today-after-hyd", async () => {
  await forceClose();
  await page.getByRole("link", { name: "Dashboard", exact: true }).first().click();
  await page.waitForTimeout(2800);
  const todayWater = await page.evaluate(() => {
    const b = document.body.innerText; const i = b.indexOf("WATER");
    return { url: location.href, snippet: b.slice(i, i + 150).replace(/\s+/g, " ") };
  });
  rec({ step: "today-after-hyd-log", todayWater });
  await page.screenshot({ path: `${OUT}/today-after-hyd-log.png`, fullPage: true });
});

// CLEANUP water
await safe("hyd-cleanup", async () => {
  await page.goto(`${BASE}/hydration`, { waitUntil: "load" }); await page.waitForTimeout(2000);
  const del = page.locator("section", { hasText: "Today's log" }).getByRole("button", { name: "Delete" });
  const n = await del.count();
  rec({ step: "hyd-cleanup-delete-count", n });
  for (let i = 0; i < n; i++) {
    await page.locator("section", { hasText: "Today's log" }).getByRole("button", { name: "Delete" }).first().click();
    await page.waitForTimeout(500);
    if (i === 0) { rec({ step: "hyd-delete-confirm", ...(await dialogInfo("water-del")) }); await page.screenshot({ path: `${OUT}/hyd-delete-confirm.png` }); }
    await page.getByRole("button", { name: /Delete entry/i }).click();
    await page.waitForTimeout(2500);
    if (!(await page.locator("section", { hasText: "Today's log" }).count())) break;
  }
  rec({ step: "hyd-after-cleanup", bodyHas8oz: await page.evaluate(() => /8 oz/.test(document.body.innerText)), hasTodayLog: !!(await page.locator("section", { hasText: "Today's log" }).count()) });
});

/* ============================ /SLEEP ============================ */
await page.goto(`${BASE}/sleep`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const sleepTrendLinkEmpty = await page.evaluate(() => {
  const a = [...document.querySelectorAll("a")].find((x) => /Sleep trends/i.test(x.textContent));
  const href = a?.getAttribute("href");
  return a ? { href, targetExists: href?.startsWith("#") ? !!document.getElementById(href.slice(1)) : "external" } : null;
});
rec({ step: "sleep-trends-link-EMPTY", sleepTrendLinkEmpty });
await page.screenshot({ path: `${OUT}/sleep-desktop-empty.png`, fullPage: true });

await safe("sleep-loglast-sweep", async () => {
  await openByName("Log last night");
  rec({ step: "sleep-loglast-open", ...(await dialogInfo("sleep-log")) });
  await page.screenshot({ path: `${OUT}/sleep-log-open.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  rec({ step: "sleep-loglast-escape", open: await dialogOpen() });
  await openByName("Log last night");
  const cb = page.getByRole("button", { name: "Close" }).first(); const had = await cb.count();
  if (had) await cb.click(); await page.waitForTimeout(400);
  rec({ step: "sleep-loglast-X", hadClose: !!had, open: await dialogOpen() });
  await openByName("Log last night");
  await page.mouse.click(6, 6); await page.waitForTimeout(400);
  rec({ step: "sleep-loglast-backdrop", open: await dialogOpen() });
  await forceClose();
});

await safe("sleep-editgoal", async () => {
  await forceClose();
  await page.getByRole("button", { name: "More options" }).first().click();
  await page.waitForTimeout(400);
  const items = await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent.trim()));
  rec({ step: "sleep-overflow-items", items });
  await page.getByRole("menuitem", { name: /Edit nightly goal/i }).click();
  await page.waitForTimeout(600);
  rec({ step: "sleep-editgoal-open", ...(await dialogInfo("sleep-editgoal")) });
  await forceClose();
});

// AFTER-ACTION: log last night (default today) -> creates a current entry
await safe("sleep-after-log", async () => {
  await openByName("Log last night");
  await page.getByRole("button", { name: /^Log sleep$/i }).click();
  await page.waitForTimeout(2800);
  const after = await page.evaluate(() => {
    const hist = document.getElementById("history");
    const a = [...document.querySelectorAll("a")].find((x) => /Sleep trends/i.test(x.textContent));
    const href = a?.getAttribute("href");
    return {
      url: location.href, hasHistory: !!hist,
      historyText: hist ? hist.textContent.replace(/\s+/g, " ").trim().slice(0, 200) : null,
      sleepTrendsTargetExists: href?.startsWith("#") ? !!document.getElementById(href.slice(1)) : null,
      panelSnippet: (document.body.innerText.match(/SLEEP[\s\S]{0,120}/) || [])[0]?.replace(/\s+/g, " ") || null,
    };
  });
  rec({ step: "sleep-after-log", after });
  await page.screenshot({ path: `${OUT}/sleep-after-log.png`, fullPage: true });
});

// History Edit + Delete (also cleans up)
await safe("sleep-history-editdelete", async () => {
  if (await page.locator("#history").count()) {
    const eb = page.locator('#history').getByRole("button", { name: "Edit" }).first();
    if (await eb.count()) {
      await eb.click(); await page.waitForTimeout(600);
      rec({ step: "sleep-history-edit-open", ...(await dialogInfo("sleep-hist-edit")) });
      await page.screenshot({ path: `${OUT}/sleep-history-edit.png` });
      await forceClose();
    }
    const db = page.locator('#history').getByRole("button", { name: "Delete" }).first();
    if (await db.count()) {
      await db.click(); await page.waitForTimeout(600);
      rec({ step: "sleep-history-delete-confirm", ...(await dialogInfo("sleep-del")) });
      await page.screenshot({ path: `${OUT}/sleep-delete-confirm.png` });
      const conf = page.getByRole("button", { name: /Delete night/i });
      if (await conf.count()) { await conf.click(); await page.waitForTimeout(2800); }
    }
  }
  rec({ step: "sleep-after-cleanup", bodyEmpty: await page.evaluate(() => /No sleep logged yet/.test(document.body.innerText)), hasHistory: !!(await page.locator("#history").count()) });
  await page.screenshot({ path: `${OUT}/sleep-after-cleanup.png`, fullPage: true });
});

writeFileSync(`${OUT}/desktop.json`, JSON.stringify(log, null, 2));
console.log("=== DESKTOP DONE ===");
await ctx.close();
await browser.close();
