// P56-C browser verification (FIX-26 hydration + FIX-27 sleep panels).
// Node Playwright. Target http://localhost:3600, Pro test account.
// NOTE: shared PROD DB. Every created row is cleaned via the flows' own
// undo/delete paths; tally tracked and reported.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3600";
const LIVE = "C:/Users/jon17/Desktop/chadchat/evidence-p56c/live";
const EMAIL = "claude-testing@example.com";
const PASSWORD = "12345678";
fs.mkdirSync(LIVE, { recursive: true });

const results = [];
let created = 0;
let cleaned = 0;
const cleanupNotes = [];
function rec(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`[${pass === true ? "PASS" : pass === false ? "FAIL" : "N/A "}] ${id}: ${detail}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(page, name) {
  try { await page.screenshot({ path: `${LIVE}/${name}.png` }); }
  catch (e) { console.log("screenshot failed", name, e.message); }
}

const PANEL = '[data-panel-role="quick-log"]';

async function login(context) {
  const page = await context.newPage();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await sleep(600);
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 16000 }).catch(() => {});
    await sleep(1500);
    if (!page.url().includes("/login")) break;
    console.log(`login attempt ${attempt + 1} still on /login; retrying`);
  }
  // verify the session sticks in the context
  await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  const ok = !page.url().includes("/login");
  console.log(`login verified=${ok} (url=${page.url()})`);
  await page.close();
  return ok;
}

async function panelState(page) { return page.getAttribute(PANEL, "data-panel-state").catch(() => null); }
async function readOz(page) {
  const el = page.locator(`${PANEL} .text-metric`).first();
  if ((await el.count()) === 0) return 0;
  const t = (await el.textContent()) || "";
  const m = t.match(/[\d,]+/);
  return m ? parseInt(m[0].replace(/,/g, ""), 10) : 0;
}
async function headlineContext(page) {
  const el = page.locator(`${PANEL} .items-baseline`).first();
  if ((await el.count()) === 0) return "";
  return ((await el.textContent()) || "").trim();
}
async function activeIsInput(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    const tag = a ? a.tagName : null;
    return { isInput: tag === "INPUT" || tag === "TEXTAREA", tag };
  });
}
async function noHOverflow(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, ok: d.scrollWidth <= d.clientWidth + 1 };
  });
}
async function overlayVisible(page) {
  // returns which overlay surface is showing the form
  return page.evaluate(() => ({
    dialog: !!document.querySelector('[role="dialog"][data-slot="dialog-content"]'),
    drawer: !!document.querySelector('[data-slot="drawer-content"]'),
  }));
}
async function selectOption(page, triggerLabel, optionText) {
  await page.locator(`[aria-label="${triggerLabel}"]`).first().click();
  await page.locator('[role="option"]').first().waitFor({ state: "visible", timeout: 4000 });
  await page.locator('[role="option"]').filter({ hasText: new RegExp(`^${optionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).first().click();
  await sleep(300);
}
async function pickCalendarDay(page, dayNum) {
  const grid = page.locator('[role="grid"]').last();
  await grid.waitFor({ state: "visible", timeout: 4000 });
  const btns = grid.locator("button").filter({ hasText: new RegExp(`^${dayNum}$`) });
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const b = btns.nth(i);
    if (!(await b.isDisabled())) { await b.click(); await sleep(350); return true; }
  }
  return false;
}
async function undoBtn(page, timeout = 6000) {
  const btn = page.getByRole("button", { name: "Undo" }).first();
  await btn.waitFor({ state: "visible", timeout });
  return btn;
}
async function toastText(page) {
  return (await page.locator("[data-sonner-toast]").first().textContent().catch(() => "")) || "";
}

// choose the safe unlogged past date (day-of-month) from the sleep panel state
async function chooseSleepDay(page) {
  const info = await page.evaluate((sel) => {
    const mm = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
    const p = document.querySelector(sel);
    const strip = [];
    if (p) for (const e of p.querySelectorAll("[aria-label]")) {
      const l = e.getAttribute("aria-label"); const m = l && l.match(/(\w{3}), (\w{3}) (\d{1,2}): (.*)/);
      if (m) strip.push({ mon: m[2], day: parseInt(m[3],10), future: /Upcoming/.test(m[4]), logged: !/Not logged|Upcoming/.test(m[4]) });
    }
    const hist = [];
    const h = document.getElementById("history");
    if (h) for (const el of h.querySelectorAll(".font-medium")) { const m=(el.textContent||"").match(/(\w{3}), (\w{3}) (\d{1,2})/); if(m) hist.push({mon:m[2],day:parseInt(m[3],10)});}
    const d = new Date();
    return { strip, hist, tm: d.getMonth()+1, td: d.getDate(), mm };
  }, PANEL);
  const mm = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
  const logged = new Set();
  for (const x of info.hist) if (mm[x.mon] === info.tm) logged.add(x.day);
  for (const x of info.strip) if (x.logged && mm[x.mon] === info.tm) logged.add(x.day);
  const stripDays = new Set(info.strip.filter((s)=>mm[s.mon]===info.tm && !s.future).map((s)=>s.day));
  let day = null;
  for (let d = info.td - 1; d >= 1; d--) { if (!logged.has(d)) { day = d; break; } }
  const inWeek = day != null && stripDays.has(day);
  return { day, inWeek, tm: info.tm, strip: info.strip, logged: [...logged] };
}

// ===================== DESKTOP =====================
async function runDesktop(context) {
  const page = await context.newPage();

  // ---------- HYDRATION ----------
  await page.goto(`${BASE}/hydration`, { waitUntil: "domcontentloaded" });
  await sleep(1600);
  if (page.url().includes("/login")) { rec("LOGIN", false, "redirected to /login; auth failed"); await page.close(); return; }
  await page.locator(PANEL).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  let st = await panelState(page);
  const priorOz = await readOz(page);
  console.log(`hydration initial state=${st} priorOz=${priorOz}`);
  await shot(page, "01-hydration-desktop-initial");

  // Check 2: open Log water, no autofocus
  try {
    await page.locator(PANEL).getByRole("button", { name: "Log water" }).first().click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
    await sleep(700);
    const title = await page.getByRole("dialog").getByText("Log water", { exact: true }).first().isVisible().catch(() => false);
    const af = await activeIsInput(page);
    await shot(page, "02-hydration-logwater-overlay-desktop");
    rec("2", !af.isInput && title, `overlay opened (title=${title}); activeElement=${af.tag}, isInput=${af.isInput}`);
  } catch (e) { rec("2", false, `open Log water failed: ${e.message}`); }

  // Check 3: tap +8 Glass (glass A) -> +8, toast Undo
  let ozAfterAdd = null;
  try {
    await page.getByRole("dialog").getByRole("button", { name: /glass of water, 8 ounces/i }).first().click();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
    const u = await undoBtn(page, 5000);
    await shot(page, "03-hydration-undo-toast-desktop");
    await sleep(400);
    ozAfterAdd = await readOz(page);
    const delta = ozAfterAdd - priorOz;
    created++;
    rec("3", delta >= 7 && delta <= 9 && (await u.isVisible()), `+8oz Glass: ${priorOz} -> ${ozAfterAdd} (delta ${delta}); Undo toast present`);
  } catch (e) { rec("3", false, `+8oz glass failed: ${e.message}`); }

  // Check 4 (CRITICAL): click toast Undo -> revert
  try {
    const u = page.getByRole("button", { name: "Undo" }).first();
    if (await u.isVisible().catch(() => false)) await u.click();
    let back = null, ok = false;
    for (let i = 0; i < 12; i++) { await sleep(500); back = await readOz(page); if (back === priorOz) { ok = true; break; } }
    if (!ok) { // fall back to reload to confirm DB removal vs client-refresh nuance
      await page.reload({ waitUntil: "domcontentloaded" }); await sleep(1500); back = await readOz(page); ok = back === priorOz;
    }
    if (ok) cleaned++; else cleanupNotes.push(`water glass A may remain (oz ${back} vs prior ${priorOz})`);
    rec("4", ok, `after Undo: headline ${back} (prior ${priorOz}); exact revert=${ok}`);
  } catch (e) { rec("4", false, `undo failed: ${e.message}`); cleanupNotes.push("water glass A undo threw"); }

  // ---- create keeper glass B, reload to populated (footer + Today's log present)
  await sleep(500);
  await page.goto(`${BASE}/hydration`, { waitUntil: "domcontentloaded" });
  await sleep(1200);
  try {
    await page.locator(PANEL).getByRole("button", { name: "Log water" }).first().click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
    await sleep(600);
    await page.getByRole("dialog").getByRole("button", { name: /glass of water, 8 ounces/i }).first().click();
    await undoBtn(page, 5000);
    created++;
    await sleep(600);
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(1500);
  } catch (e) { cleanupNotes.push(`could not create keeper glass B: ${e.message}`); }

  // Check 1: structure (populated)
  try {
    st = await panelState(page);
    const struct = await page.evaluate((sel) => {
      const p = document.querySelector(sel);
      if (!p) return { ok: false };
      const gauge = p.querySelector('[role="img"] svg');
      const paths = gauge ? gauge.querySelectorAll("path").length : 0;
      let bars = 0;
      for (const r of [...p.querySelectorAll("div.h-12")]) if (r.children.length === 7) bars = 7;
      const dots = p.querySelectorAll("span.rounded-full.size-3").length;
      const metric = p.querySelector(".text-metric");
      const headText = (p.querySelector(".items-baseline")?.textContent || "").trim();
      return { ok: !!gauge && paths >= 2 && bars === 7 && dots === 7 && !!metric && /of .*goal/i.test(headText), gauge: !!gauge, paths, bars, dots, metric: !!metric, headText };
    }, PANEL);
    await shot(page, "01b-hydration-panel-populated-desktop");
    rec("1", struct.ok, `state=${st}; liquid gauge svg=${struct.gauge} (wave paths=${struct.paths}), weekBars=${struct.bars}/7, dot strip=${struct.dots}/7, headline metric=${struct.metric}, context="${struct.headText}"`);
  } catch (e) { rec("1", false, `structure read failed: ${e.message}`); }

  // Check 5: More options -> items -> Log a past day -> #log-past-day
  try {
    await page.locator(PANEL).getByRole("button", { name: "More options" }).first().click();
    await sleep(400);
    const editGoal = await page.getByRole("menuitem", { name: "Edit daily goal" }).isVisible().catch(() => false);
    const pastDay = await page.getByRole("menuitem", { name: "Log a past day" }).isVisible().catch(() => false);
    await shot(page, "05-hydration-overflow-menu-desktop");
    await page.getByRole("menuitem", { name: "Log a past day" }).click();
    await sleep(900);
    const hash = await page.evaluate(() => window.location.hash);
    const inView = await page.evaluate(() => { const el = document.getElementById("log-past-day"); if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= -5 && r.top < window.innerHeight; });
    rec("5", editGoal && pastDay && hash === "#log-past-day" && inView, `overflow lists Edit daily goal=${editGoal} + Log a past day=${pastDay}; click -> hash=${hash}, #log-past-day in view=${inView}`);
  } catch (e) { rec("5", false, `overflow / past day failed: ${e.message}`); }

  // Check 6: backfill 20 oz yesterday -> toast Undo -> Undo -> Removed.
  try {
    const section = page.locator("#log-past-day");
    await section.scrollIntoViewIfNeeded();
    await page.locator("#water-backfill-oz").fill("20");
    await section.getByRole("button", { name: "Add water" }).click();
    const u = await undoBtn(page, 6000);
    const tt = await toastText(page);
    await shot(page, "06-hydration-backfill-undo-toast-desktop");
    created++;
    await u.click();
    let removed = false;
    for (let i = 0; i < 10; i++) { await sleep(400); removed = await page.getByText("Removed.", { exact: true }).isVisible().catch(() => false); if (removed) break; }
    if (removed) cleaned++; else cleanupNotes.push("backfill 20oz/yesterday 'Removed.' not confirmed");
    rec("6", /Added 20 oz to/i.test(tt) && removed, `backfill toast="${tt.trim()}" (Undo present); after Undo 'Removed.'=${removed}`);
  } catch (e) { rec("6", false, `backfill failed: ${e.message}`); cleanupNotes.push("backfill threw"); }

  // Check 7: Edit daily goal overlay, no autofocus, Escape, no change
  try {
    const ctxBefore = await headlineContext(page);
    await page.locator(PANEL).getByRole("button", { name: "More options" }).first().click();
    await sleep(300);
    await page.getByRole("menuitem", { name: "Edit daily goal" }).click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 4000 });
    await sleep(500);
    const af = await activeIsInput(page);
    const goalTitle = await page.getByRole("dialog").getByText("Daily hydration goal").isVisible().catch(() => false);
    await shot(page, "07-hydration-editgoal-overlay-desktop");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
    await sleep(500);
    const ctxAfter = await headlineContext(page);
    rec("7", !af.isInput && goalTitle && ctxBefore === ctxAfter, `goal overlay (title=${goalTitle}); activeElement=${af.tag} isInput=${af.isInput}; context "${ctxBefore}"->"${ctxAfter}" unchanged=${ctxBefore === ctxAfter}`);
  } catch (e) { rec("7", false, `edit goal failed: ${e.message}`); }

  // Check 8: detail link -> #history
  try {
    const link = page.locator(`${PANEL} a`).filter({ hasText: "Hydration history" }).first();
    const href = (await link.count()) ? await link.getAttribute("href") : null;
    const histExists = await page.locator("#history").count();
    rec("8", !!href && href.includes("#history") && histExists > 0, `detail link "Hydration history" href="${href}"; #history exists=${histExists > 0}`);
  } catch (e) { rec("8", false, `detail link failed: ${e.message}`); }

  // hydration check 15 (water half) scan
  const hydrationPopoverForm = await page.evaluate(() => {
    const pops = [...document.querySelectorAll('[data-slot="popover-content"],[data-radix-popper-content-wrapper]')];
    return pops.some((p) => p.querySelector('input[inputmode="numeric"]') && /oz|water/i.test(p.textContent || ""));
  });

  // CLEANUP glass B via Today's log Delete entry
  try {
    const del = page.locator("#history").first(); // ensure page loaded
    const todayDelete = page.getByRole("button", { name: "Delete" });
    // Today's log section header "Today's log"; its Delete buttons live there
    const tlDelete = page.locator("section").filter({ hasText: "Today's log" }).getByRole("button", { name: "Delete" }).first();
    if (await tlDelete.isVisible().catch(() => false)) {
      await tlDelete.scrollIntoViewIfNeeded();
      await tlDelete.click();
      await page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 4000 });
      await page.getByRole("button", { name: "Delete entry" }).click();
      await sleep(1500);
      await page.reload({ waitUntil: "domcontentloaded" }); await sleep(1200);
      const stAfter = await panelState(page);
      const cleanedOk = stAfter === "empty";
      if (cleanedOk) cleaned++; else cleanupNotes.push(`keeper glass B may remain (state after delete=${stAfter})`);
      console.log(`hydration keeper cleanup: state=${stAfter}`);
    } else { cleanupNotes.push("Today's log Delete not found for glass B cleanup"); }
  } catch (e) { cleanupNotes.push(`glass B cleanup failed: ${e.message}`); }

  // ---------- SLEEP ----------
  await page.goto(`${BASE}/sleep`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await page.locator(PANEL).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  await shot(page, "08-sleep-desktop-initial");
  const pick = await chooseSleepDay(page);
  console.log(`sleep target day=${pick.day} inWeek=${pick.inWeek} loggedThisMonth=${pick.logged}`);

  // Check 10: open create dialog (primary or overflow)
  try {
    const primary = page.locator(PANEL).getByRole("button", { name: "Log last night" }).first();
    if (await primary.isVisible().catch(() => false)) await primary.click();
    else { await page.locator(PANEL).getByRole("button", { name: "More options" }).first().click(); await sleep(300); await page.getByRole("menuitem", { name: "Log a past night" }).click(); }
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
    await sleep(600);
    const af = await activeIsInput(page);
    const ov = await overlayVisible(page);
    const title = await page.getByRole("dialog").getByText("Log sleep", { exact: true }).isVisible().catch(() => false);
    await shot(page, "10-sleep-log-overlay-desktop");
    rec("10", !af.isInput && ov.dialog && !ov.drawer, `AdaptiveDialog=centered dialog=${ov.dialog} (drawer=${ov.drawer}); title 'Log sleep'=${title}; activeElement=${af.tag} isInput=${af.isInput}`);
  } catch (e) { rec("10", false, `open sleep log failed: ${e.message}`); }

  // Check 11 (toast part) + 12 (undo) on Night A
  let toastA = "";
  let replacesA = false;
  try {
    if (pick.day != null) {
      await page.locator("#sleep-log-night").click();
      await sleep(400);
      await pickCalendarDay(page, pick.day);
    }
    replacesA = await page.getByText(/Replaces the/i).isVisible().catch(() => false);
    await selectOption(page, "Hours slept", "7 h");
    await selectOption(page, "Minutes slept", "15 m");
    await page.getByRole("button", { name: "4 stars: Good" }).click();
    await sleep(200);
    await shot(page, "11-sleep-log-filled-desktop");
    await page.getByRole("dialog").getByRole("button", { name: "Log sleep" }).click();
    await undoBtn(page, 6000);
    toastA = await toastText(page);
    await shot(page, "11b-sleep-undo-toast-desktop");
    created++;
    // Check 12 immediately (CRITICAL) - undo within window
    const u = page.getByRole("button", { name: "Undo" }).first();
    if (await u.isVisible().catch(() => false)) await u.click();
    await sleep(2500);
    await page.reload({ waitUntil: "domcontentloaded" }); await sleep(1500);
    const stillThere = await page.evaluate(({ day, mon }) => {
      const mm={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
      const h=document.getElementById("history"); if(!h) return false;
      for (const el of h.querySelectorAll(".font-medium")){const m=(el.textContent||"").match(/(\w{3}), (\w{3}) (\d{1,2})/); if(m&&parseInt(m[3],10)===day&&mm[m[2]]===mon) return true;} return false;
    }, { day: pick.day, mon: pick.tm });
    if (!stillThere) cleaned++; else cleanupNotes.push(`sleep Night A (day ${pick.day}) still present after Undo`);
    rec("12", !stillThere, `after Undo + reload: day ${pick.day} present in history=${stillThere}; removed=${!stillThere}`);
  } catch (e) { rec("12", false, `sleep undo failed: ${e.message}`); cleanupNotes.push(`sleep Night A undo threw (day ${pick.day})`); }

  // ---- create keeper Night B (same date), reload to populated
  let bLoggedOk = false;
  try {
    await page.locator(PANEL).getByRole("button", { name: "Log last night" }).first().click().catch(async () => {
      await page.locator(PANEL).getByRole("button", { name: "More options" }).first().click(); await sleep(300); await page.getByRole("menuitem", { name: "Log a past night" }).click();
    });
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
    await sleep(600);
    if (pick.day != null) { await page.locator("#sleep-log-night").click(); await sleep(400); await pickCalendarDay(page, pick.day); }
    await selectOption(page, "Hours slept", "7 h");
    await selectOption(page, "Minutes slept", "15 m");
    await page.getByRole("button", { name: "4 stars: Good" }).click();
    await sleep(200);
    await page.getByRole("dialog").getByRole("button", { name: "Log sleep" }).click();
    await undoBtn(page, 6000);
    created++;
    bLoggedOk = true;
    await sleep(700);
    await page.reload({ waitUntil: "domcontentloaded" }); await sleep(1600);
  } catch (e) { cleanupNotes.push(`could not create keeper Night B: ${e.message}`); }

  // Check 9: structure + headline (populated)
  try {
    const st9 = await panelState(page);
    const struct = await page.evaluate((sel) => {
      const p = document.querySelector(sel);
      if (!p) return { ok: false };
      const colContainer = [...p.querySelectorAll("div.items-end")].find((d) => d.querySelectorAll(":scope > *[aria-label]").length >= 7);
      const cols = colContainer ? colContainer.querySelectorAll(":scope > *[aria-label]").length : 0;
      const dots = p.querySelectorAll("span.rounded-full.size-3").length;
      const dashed = p.querySelectorAll(".border-dashed").length;
      const headText = (p.querySelector(".items-baseline")?.textContent || p.querySelector(".text-metric")?.textContent || "").trim();
      return { ok: cols === 7 && dots === 7 && dashed > 0 && headText.length > 0, cols, dots, dashed, headText };
    }, PANEL);
    await shot(page, "09-sleep-panel-desktop");
    rec("9", struct.ok, `state=${st9}; night columns=${struct.cols}/7, dot strip=${struct.dots}/7, dashed goal line els=${struct.dashed}, headline="${struct.headText}"`);
  } catch (e) { rec("9", false, `sleep structure failed: ${e.message}`); }

  // Check 11 (fill part, from Night B) + finalize verdict
  try {
    const filled = await page.evaluate(({ sel, day }) => {
      const p = document.querySelector(sel);
      const labels = [...p.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label") || "");
      return labels.some((l) => new RegExp(`\\w{3} ${day}: 7h 15m`).test(l));
    }, { sel: PANEL, day: pick.day });
    const toastOk = /Sleep logged for .*7h 15m/i.test(toastA || "");
    const fillOk = pick.inWeek ? filled : true; // fill only asserted when in current week
    rec("11", toastOk && !replacesA && fillOk, `toast="${(toastA||'').trim()}" (replaces-warning=${replacesA}); day ${pick.day} inWeek=${pick.inWeek}; week column/dot filled=${pick.inWeek ? filled : "n/a (out of week)"}`);
  } catch (e) { rec("11", false, `sleep log verify failed: ${e.message}`); }

  // Check 13: History Delete (confirm names night) -> Cancel; Edit (seeded dialog) -> close
  try {
    const hasRows = (await page.locator('#history .font-medium').count()) > 0;
    if (!hasRows) { rec("13", null, "no History rows to exercise (unexpected: keeper Night B not persisted)"); }
    else {
      await page.locator("#history").getByRole("button", { name: "Delete" }).first().click();
      await page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 4000 });
      await sleep(300);
      const confTxt = await page.getByRole("alertdialog").textContent();
      const namesNight = /Delete the .* night of \d/i.test(confTxt || "");
      await shot(page, "13-sleep-delete-confirm-desktop");
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("alertdialog").waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
      await sleep(300);
      await page.locator("#history").getByRole("button", { name: "Edit" }).first().click();
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 4000 });
      await sleep(400);
      const ov = await overlayVisible(page);
      const editTitle = await page.getByRole("dialog").getByText("Edit sleep", { exact: true }).isVisible().catch(() => false);
      const seeded = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return !!(d && d.querySelector('[aria-label="Hours slept"]')); });
      await shot(page, "13b-sleep-edit-dialog-desktop");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
      rec("13", namesNight && ov.dialog && !ov.drawer && editTitle && seeded, `Delete confirm names night=${namesNight} ("${(confTxt||'').replace(/\s+/g,' ').trim().slice(0,90)}"); Edit centered dialog=${ov.dialog}, title 'Edit sleep'=${editTitle}, seeded=${seeded}`);
    }
  } catch (e) { rec("13", false, `history edit/delete failed: ${e.message}`); }

  // Check 14: overflow Edit nightly goal -> 7h/8h/9h presets -> close
  try {
    await page.locator(PANEL).getByRole("button", { name: "More options" }).first().click();
    await sleep(300);
    await page.getByRole("menuitem", { name: "Edit nightly goal" }).click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 4000 });
    await sleep(400);
    const goalTitle = await page.getByRole("dialog").getByText("Nightly sleep goal").isVisible().catch(() => false);
    const p7 = await page.getByRole("dialog").getByRole("button", { name: "7h" }).isVisible().catch(() => false);
    const p8 = await page.getByRole("dialog").getByRole("button", { name: "8h" }).isVisible().catch(() => false);
    const p9 = await page.getByRole("dialog").getByRole("button", { name: "9h" }).isVisible().catch(() => false);
    await shot(page, "14-sleep-editgoal-overlay-desktop");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
    rec("14", goalTitle && p7 && p8 && p9, `nightly goal overlay (title=${goalTitle}); presets 7h=${p7} 8h=${p8} 9h=${p9}`);
  } catch (e) { rec("14", false, `edit nightly goal failed: ${e.message}`); }

  // Check 15: no popover-anchored log forms
  try {
    const sleepPopoverForm = await page.evaluate(() => {
      const pops = [...document.querySelectorAll('[data-slot="popover-content"],[data-radix-popper-content-wrapper]')];
      return pops.some((p) => p.querySelector('[aria-label="Hours slept"], [aria-label="Minutes slept"]'));
    });
    rec("15", !sleepPopoverForm && !hydrationPopoverForm, `hydration log-in-popover=${hydrationPopoverForm}; sleep log-in-popover=${sleepPopoverForm} (forms live in AdaptiveDialog/Drawer)`);
  } catch (e) { rec("15", false, `popover scan failed: ${e.message}`); }

  // CLEANUP keeper Night B via History Delete -> confirm
  try {
    const hasRows = (await page.locator('#history .font-medium').count()) > 0;
    if (hasRows) {
      await page.locator("#history").getByRole("button", { name: "Delete" }).first().click();
      await page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 4000 });
      await page.getByRole("button", { name: "Delete night" }).click();
      await sleep(1500);
      await page.reload({ waitUntil: "domcontentloaded" }); await sleep(1300);
      const rowsAfter = await page.locator('#history .font-medium').count();
      const stAfter = await panelState(page);
      const cleanedOk = rowsAfter === 0 || stAfter === "empty";
      if (cleanedOk) cleaned++; else cleanupNotes.push(`keeper Night B may remain (rows after=${rowsAfter}, state=${stAfter})`);
      console.log(`sleep keeper cleanup: rowsAfter=${rowsAfter} state=${stAfter}`);
    } else if (bLoggedOk) { cleanupNotes.push("keeper Night B not found in history for cleanup"); }
  } catch (e) { cleanupNotes.push(`Night B cleanup failed: ${e.message}`); }

  await page.close();
}

// ===================== MOBILE (390x844, touch) =====================
async function runMobile(context) {
  const page = await context.newPage();

  // HYDRATION 2-4
  await page.goto(`${BASE}/hydration`, { waitUntil: "domcontentloaded" });
  await sleep(1700);
  await page.locator(PANEL).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  await shot(page, "20-hydration-390-initial");
  const priorOz = await readOz(page);

  try {
    await page.locator(PANEL).getByRole("button", { name: "Log water" }).first().tap();
    await page.locator('[data-slot="drawer-content"]').waitFor({ state: "visible", timeout: 5000 });
    await sleep(800);
    const af = await activeIsInput(page);
    const sheet = await page.evaluate(() => { const d = document.querySelector('[data-slot="drawer-content"]'); if (!d) return { present: false }; const r = d.getBoundingClientRect(); return { present: true, bottomAnchored: Math.abs(r.bottom - window.innerHeight) < 3, dir: d.getAttribute("data-vaul-drawer-direction") }; });
    const ov = await noHOverflow(page);
    await shot(page, "21-hydration-logwater-sheet-390");
    rec("M2", sheet.present && sheet.bottomAnchored && !af.isInput && ov.ok, `bottom sheet present=${sheet.present} bottomAnchored=${sheet.bottomAnchored} dir=${sheet.dir}; activeInput=${af.isInput}; noHOverflow=${ov.ok} (${ov.scrollWidth}<=${ov.clientWidth})`);
  } catch (e) { rec("M2", false, `mobile Log water sheet failed: ${e.message}`); }

  try {
    await page.locator('[data-slot="drawer-content"]').getByRole("button", { name: /glass of water, 8 ounces/i }).first().tap();
    await page.locator('[data-slot="drawer-content"]').waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
    const u = await undoBtn(page, 5000);
    await shot(page, "22-hydration-undo-toast-390");
    await sleep(400);
    const newOz = await readOz(page); created++;
    const delta = newOz - priorOz;
    rec("M3", delta >= 7 && delta <= 9 && (await u.isVisible()), `+8oz glass (tap): ${priorOz} -> ${newOz} (delta ${delta}); Undo present`);
  } catch (e) { rec("M3", false, `mobile +8oz glass failed: ${e.message}`); }

  try {
    const u = page.getByRole("button", { name: "Undo" }).first();
    if (await u.isVisible().catch(() => false)) await u.tap();
    let back = null, ok = false;
    for (let i = 0; i < 12; i++) { await sleep(500); back = await readOz(page); if (back === priorOz) { ok = true; break; } }
    if (!ok) { await page.reload({ waitUntil: "domcontentloaded" }); await sleep(1500); back = await readOz(page); ok = back === priorOz; }
    if (ok) cleaned++; else cleanupNotes.push(`mobile water glass may remain (oz ${back} vs ${priorOz})`);
    rec("M4", ok, `after Undo (tap): ${back} (prior ${priorOz}); exact revert=${ok}`);
  } catch (e) { rec("M4", false, `mobile undo failed: ${e.message}`); }

  // SLEEP 10-12
  await page.goto(`${BASE}/sleep`, { waitUntil: "domcontentloaded" });
  await sleep(1700);
  await page.locator(PANEL).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  await shot(page, "23-sleep-390-initial");
  const pick = await chooseSleepDay(page);
  console.log(`mobile sleep target day=${pick.day} inWeek=${pick.inWeek}`);

  try {
    const primary = page.locator(PANEL).getByRole("button", { name: "Log last night" }).first();
    if (await primary.isVisible().catch(() => false)) await primary.tap();
    else { await page.locator(PANEL).getByRole("button", { name: "More options" }).first().tap(); await sleep(300); await page.getByRole("menuitem", { name: "Log a past night" }).tap(); }
    await page.locator('[data-slot="drawer-content"]').waitFor({ state: "visible", timeout: 5000 });
    await sleep(800);
    const af = await activeIsInput(page);
    const sheet = await page.evaluate(() => { const d = document.querySelector('[data-slot="drawer-content"]'); if (!d) return { present: false }; const r = d.getBoundingClientRect(); return { present: true, bottomAnchored: Math.abs(r.bottom - window.innerHeight) < 3, dir: d.getAttribute("data-vaul-drawer-direction") }; });
    const ov = await noHOverflow(page);
    await shot(page, "24-sleep-log-sheet-390");
    rec("M10", sheet.present && sheet.bottomAnchored && !af.isInput && ov.ok, `bottom sheet present=${sheet.present} bottomAnchored=${sheet.bottomAnchored} dir=${sheet.dir}; activeInput=${af.isInput}; noHOverflow=${ov.ok}`);
  } catch (e) { rec("M10", false, `mobile sleep sheet failed: ${e.message}`); }

  let toastM = "";
  try {
    if (pick.day != null) { await page.locator("#sleep-log-night").tap(); await sleep(400); await pickCalendarDay(page, pick.day); }
    const replaces = await page.getByText(/Replaces the/i).isVisible().catch(() => false);
    await selectOption(page, "Hours slept", "7 h");
    await selectOption(page, "Minutes slept", "15 m");
    await page.getByRole("button", { name: "4 stars: Good" }).tap();
    await sleep(200);
    await shot(page, "25-sleep-log-filled-390");
    await page.locator('[data-slot="drawer-content"]').getByRole("button", { name: "Log sleep" }).tap();
    await undoBtn(page, 6000);
    toastM = await toastText(page); created++;
    await shot(page, "26-sleep-undo-toast-390");
    rec("M11", /Sleep logged for .*7h 15m/i.test(toastM) && !replaces, `mobile day=${pick.day} (replaces=${replaces}); toast="${toastM.trim()}"`);
  } catch (e) { rec("M11", false, `mobile sleep log failed: ${e.message}`); cleanupNotes.push(`mobile sleep log threw (day ${pick.day})`); }

  try {
    const u = page.getByRole("button", { name: "Undo" }).first();
    if (await u.isVisible().catch(() => false)) await u.tap();
    await sleep(2500);
    await page.reload({ waitUntil: "domcontentloaded" }); await sleep(1500);
    const stillThere = await page.evaluate(({ day, mon }) => {
      const mm={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
      const h=document.getElementById("history"); if(!h) return false;
      for (const el of h.querySelectorAll(".font-medium")){const m=(el.textContent||"").match(/(\w{3}), (\w{3}) (\d{1,2})/); if(m&&parseInt(m[3],10)===day&&mm[m[2]]===mon) return true;} return false;
    }, { day: pick.day, mon: pick.tm });
    if (!stillThere) cleaned++; else cleanupNotes.push(`mobile sleep entry day ${pick.day} still present after Undo`);
    rec("M12", !stillThere, `after Undo+reload: day ${pick.day} present=${stillThere}; removed=${!stillThere}`);
  } catch (e) { rec("M12", false, `mobile sleep undo failed: ${e.message}`); }

  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
  await desktop.clearCookies();
  const dOk = await login(desktop);
  if (!dOk) { rec("LOGIN-desktop", false, "could not authenticate Pro test account"); }
  else await runDesktop(desktop);
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: "dark", reducedMotion: "reduce" });
  await mobile.clearCookies();
  const mOk = await login(mobile);
  if (!mOk) { rec("LOGIN-mobile", false, "could not authenticate Pro test account"); }
  else await runMobile(mobile);
  await mobile.close();

  await browser.close();

  const summary = { results, created, cleaned, cleanupNotes };
  fs.writeFileSync(`${LIVE}/results.json`, JSON.stringify(summary, null, 2));
  const pass = results.filter((r) => r.pass === true).length;
  const fail = results.filter((r) => r.pass === false).length;
  const na = results.filter((r) => r.pass === null).length;
  console.log(`\n==== SUMMARY: ${pass} PASS / ${fail} FAIL / ${na} N/A ====`);
  console.log(`Rows created=${created}, cleaned=${cleaned}`);
  if (cleanupNotes.length) console.log("CLEANUP NOTES:\n" + cleanupNotes.join("\n"));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
