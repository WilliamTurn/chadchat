/**
 * P2-D LIVE-SURFACE REGRESSION probe. READ-ONLY on product data.
 * Logs in with the Pro test account, opens (never saves) the /today target
 * editor + /goals delete confirm + mobile nav, at 390 and desktop.
 * Screenshots -> evidence-p2d/audit/. NEVER submits/saves/deletes.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3600";
const OUT =
  "C:/Users/jon17/Desktop/chadlatest/audits/dashboard-overhaul-2026-07-11/evidence-p2d/audit";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (id, pass, value) => {
  results.push({ id, pass, value });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} :: ${value}`);
};

async function login(context) {
  const p = await context.newPage();
  const errs = [];
  p.on("response", (r) => {
    if (r.url().includes("/login") && r.status() >= 500) errs.push(r.status());
  });
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/login-page.png` });
  const emailSel = 'input[type=email], input[name=email], #email';
  const hasForm = await p.locator(emailSel).count();
  if (!hasForm) {
    rec("LOGIN form renders", false, `no email input; login5xx=${errs.join(",") || "none"}`);
    return { p, ok: false };
  }
  await p.locator(emailSel).first().fill("claude-testing@example.com");
  await p.locator('input[type=password], input[name=password], #password').first().fill("12345678");
  await Promise.all([
    p.waitForLoadState("networkidle").catch(() => {}),
    // The Google OAuth button is also a type=submit and sits first in the
    // DOM; target the credential form's own submit (P2-Z fix: the generic
    // selector silently walked the OAuth path and unauthenticated pages).
    p.locator('form:has(input[type=password]) button[type=submit], button:has-text("Log in"), button:has-text("Sign in")').first().click(),
  ]);
  await p.waitForTimeout(1500);
  const url = p.url();
  const ok = !url.includes("/login");
  rec("LOGIN succeeds (leaves /login)", ok, `landedAt=${url}`);
  return { p, ok };
}

async function run() {
  const browser = await chromium.launch();

  // ---- DESKTOP ----
  const cDesk = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  const { p, ok } = await login(cDesk);
  if (ok) {
    // /today - look for a target/goal editor dialog trigger
    await p.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    await p.screenshot({ path: `${OUT}/today-desktop.png` });
    // Try to find an edit/target control
    const editTriggers = await p.locator('button:has-text("Edit"), button:has-text("target"), button[aria-label*="edit" i], button[aria-label*="target" i]').count();
    rec("TODAY loads for Pro account", true, `editish triggers=${editTriggers}`);

    // /goals delete confirm
    await p.goto(`${BASE}/goals`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    await p.screenshot({ path: `${OUT}/goals-desktop.png` });
    const delTriggers = p.locator('button:has-text("Delete"), button[aria-label*="delete" i]');
    const delCount = await delTriggers.count();
    if (delCount > 0) {
      await delTriggers.first().click();
      const alert = await p.waitForSelector("[data-slot=alert-dialog-content]", { state: "visible", timeout: 4000 }).then(() => true).catch(() => false);
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${OUT}/goals-delete-confirm-desktop.png` });
      // CANCEL only - never delete
      if (alert) {
        await p.locator("[data-slot=alert-dialog-cancel]").click().catch(() => {});
        const closed = await p.waitForSelector("[data-slot=alert-dialog-content]", { state: "hidden", timeout: 3000 }).then(() => true).catch(() => false);
        rec("GOALS delete confirm opens + cancels (no delete)", alert && closed, `alertOpened=${alert}, cancelled=${closed}`);
      } else {
        rec("GOALS delete confirm opens", false, `delTriggers=${delCount} but no alert-dialog appeared`);
      }
    } else {
      rec("GOALS delete trigger present", false, `delTriggers=0 (no goal rows or different markup)`);
    }
  }
  await cDesk.close();

  // ---- MOBILE 390 ----
  const cMob = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: "dark" });
  const { p: pm, ok: okm } = await login(cMob);
  if (okm) {
    await pm.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
    await pm.waitForTimeout(2000);
    await pm.screenshot({ path: `${OUT}/today-390.png` });
    // mobile nav / sidebar sheet
    const navTrig = pm.locator('button[aria-label*="menu" i], button[aria-label*="nav" i], [data-slot=sheet-trigger], button:has(svg.lucide-menu)');
    const navCount = await navTrig.count();
    if (navCount > 0) {
      await navTrig.first().tap().catch(async () => { await navTrig.first().click(); });
      const sheet = await pm.waitForSelector("[data-slot=sheet-content], [data-slot=drawer-content]", { state: "visible", timeout: 4000 }).then(() => true).catch(() => false);
      await pm.waitForTimeout(400);
      await pm.screenshot({ path: `${OUT}/mobile-nav-390.png` });
      const activeTag = await pm.evaluate(() => document.activeElement?.tagName?.toLowerCase() ?? "none");
      rec("MOBILE nav sheet opens + no input focus", sheet && !["input","textarea","select"].includes(activeTag), `navTriggers=${navCount}, sheetOpened=${sheet}, active=<${activeTag}>`);
      await pm.keyboard.press("Escape").catch(() => {});
    } else {
      rec("MOBILE nav trigger present", false, "no nav/menu trigger found at 390");
    }
  }
  await cMob.close();

  await browser.close();
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== LIVE: ${pass}/${results.length} PASS ===`);
}
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
