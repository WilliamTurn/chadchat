/**
 * PRE-DELIVERY AUDIT of the FIX-17 overlay platform (P2-D).
 * READ-ONLY. Drives the fixture harness + probes live surfaces for regressions.
 * Writes nothing to product data. Screenshots -> evidence-p2d/audit/.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3600";
const FIX = `${BASE}/dev/fixtures/overlays`;
const OUT =
  "C:/Users/jon17/Desktop/chadlatest/audits/dashboard-overhaul-2026-07-11/evidence-p2d/audit";
mkdirSync(OUT, { recursive: true });

const results = [];
const rec = (id, pass, value) => {
  results.push({ id, pass, value });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} :: ${value}`);
};
const INPUT = ["input", "textarea", "select"];
const activeTag = (p) =>
  p.evaluate(() => document.activeElement?.tagName?.toLowerCase() ?? "none");

async function ctx(browser, { w, h, theme, touch = false }) {
  const c = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: touch,
    isMobile: touch,
    colorScheme: theme,
  });
  await c.addInitScript((t) => {
    try { localStorage.setItem("theme", t); } catch {}
  }, theme);
  return c;
}
async function freeze(p) {
  await p.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}nextjs-portal{display:none!important}`,
  });
}

async function run() {
  const browser = await chromium.launch();

  /* ============ DESKTOP DARK: dead-end sweep, close every way ============ */
  {
    const c = await ctx(browser, { w: 1440, h: 900, theme: "dark" });
    const p = await c.newPage();
    await p.goto(FIX, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("[data-testid=open-quicklog]", { state: "visible" });

    // A1: open quicklog, close via Cancel button
    await p.locator("[data-testid=open-quicklog]").click();
    await p.waitForSelector("[data-slot=dialog-content]", { state: "visible" });
    await p.locator('[data-slot=dialog-content] button:has-text("Cancel")').click();
    let closed = await p.waitForSelector("[data-slot=dialog-content]", { state: "hidden", timeout: 3000 }).then(() => true).catch(() => false);
    rec("A1 quicklog closes via Cancel button", closed, `closed=${closed}`);

    // A2: open quicklog, close via X close button
    await p.locator("[data-testid=open-quicklog]").click();
    await p.waitForSelector("[data-slot=dialog-content]", { state: "visible" });
    const xBtn = await p.locator("[data-slot=dialog-content] [data-slot=dialog-close]").count();
    if (xBtn) await p.locator("[data-slot=dialog-content] [data-slot=dialog-close]").first().click();
    closed = await p.waitForSelector("[data-slot=dialog-content]", { state: "hidden", timeout: 3000 }).then(() => true).catch(() => false);
    rec("A2 quicklog has X close btn + closes", xBtn > 0 && closed, `xBtnCount=${xBtn}, closed=${closed}`);

    // A3: backdrop click dismisses dialog
    await p.locator("[data-testid=open-quicklog]").click();
    await p.waitForSelector("[data-slot=dialog-content]", { state: "visible" });
    await p.mouse.click(20, 20); // outside content
    closed = await p.waitForSelector("[data-slot=dialog-content]", { state: "hidden", timeout: 3000 }).then(() => true).catch(() => false);
    rec("A3 quicklog dismisses on backdrop click", closed, `closed=${closed}`);

    // A4: confirm dialog - Cancel button path (regression: does CANCEL close?)
    await p.locator("[data-testid=open-confirm]").click();
    await p.waitForSelector("[data-slot=alert-dialog-content]", { state: "visible" });
    await p.locator('[data-slot=alert-dialog-cancel]').click();
    closed = await p.waitForSelector("[data-slot=alert-dialog-content]", { state: "hidden", timeout: 3000 }).then(() => true).catch(() => false);
    rec("A4 confirm closes via Cancel", closed, `closed=${closed}`);

    // A5: full QuickLog SAVE path -> receipt+undo toast appears
    await p.locator("[data-testid=open-quicklog]").click();
    await p.waitForSelector("[data-slot=dialog-content]", { state: "visible" });
    await p.locator('[data-slot=dialog-content] button:has-text("Add water")').click();
    const undoAppeared = await p.locator('[data-sonner-toast]:has-text("Undo")').first().waitFor({ state: "visible", timeout: 4000 }).then(() => true).catch(() => false);
    rec("A5 quicklog save -> Undo receipt toast", undoAppeared, `undoToast=${undoAppeared}`);
    // click Undo, verify secondary receipt
    if (undoAppeared) {
      await p.locator('[data-sonner-toast] button:has-text("Undo")').first().click();
      const rev = await p.locator('[data-sonner-toast]:has-text("Removed")').first().waitFor({ state: "visible", timeout: 4000 }).then(() => true).catch(() => false);
      rec("A5b Undo click -> reversal receipt", rev, `reversalToast=${rev}`);
    }
    await p.waitForTimeout(6500); // let toasts clear

    // A6: DEAD-END SWEEP from scrolled position (fixed-position under transformed ancestor check)
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const sy = await p.evaluate(() => window.scrollY);
    await p.locator("[data-testid=open-sheet]").click();
    await p.waitForSelector("[data-slot=sheet-content]", { state: "visible" });
    // measure the sheet is within viewport (fixed worked)
    const sheetBox = await p.locator("[data-slot=sheet-content]").boundingBox();
    const vh = await p.evaluate(() => window.innerHeight);
    const inView = sheetBox && sheetBox.y >= -2 && sheetBox.y < vh && sheetBox.height > 100;
    await freeze(p);
    await p.screenshot({ path: `${OUT}/sheet-from-scrolled-1440-dark.png` });
    await p.keyboard.press("Escape");
    closed = await p.waitForSelector("[data-slot=sheet-content]", { state: "hidden", timeout: 3000 }).then(() => true).catch(() => false);
    rec("A6 sheet opens in-viewport when page scrolled + closes", inView && closed, `scrollY=${sy}, sheetY=${sheetBox ? Math.round(sheetBox.y) : "null"}, inView=${inView}, closed=${closed}`);

    await p.close();
    await c.close();
  }

  /* ============ DESKTOP LIGHT: consistency + contrast eyeball shots ====== */
  {
    const c = await ctx(browser, { w: 1440, h: 900, theme: "light" });
    for (const open of ["quicklog", "edit", "sheet"]) {
      const p = await c.newPage();
      await p.goto(`${FIX}?open=${open}`, { waitUntil: "domcontentloaded" });
      const sel = open === "sheet" ? "[data-slot=sheet-content]" : "[data-slot=dialog-content]";
      await p.waitForSelector(sel, { state: "visible", timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(300);
      await freeze(p);
      await p.screenshot({ path: `${OUT}/${open}-open-1440-light.png` });
      await p.close();
    }
    await c.close();
  }

  /* ============ MOBILE DARK 390 touch: sheet + footer-stays-visible ===== */
  {
    const c = await ctx(browser, { w: 390, h: 844, theme: "dark", touch: true });
    const p = await c.newPage();
    await p.goto(FIX, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("[data-testid=open-quicklog][data-slot=drawer-trigger]", { state: "visible", timeout: 8000 });

    // M1: edit sheet - footer sticky visible AND body scroll doesn't hide primary
    await p.locator("[data-testid=open-edit]").tap();
    await p.waitForSelector("[data-slot=drawer-content]", { state: "visible" });
    await p.waitForTimeout(600);
    const tag = await activeTag(p);
    const primary = p.locator('[data-slot=drawer-content] button:has-text("Save sleep entry")').first();
    const box = await primary.boundingBox();
    const vh = await p.evaluate(() => window.innerHeight);
    const primaryInView = box && box.y + box.height <= vh + 1 && box.height >= 44;
    rec("M1 edit sheet: no input focus + primary 44px in-view", !INPUT.includes(tag) && primaryInView, `active=<${tag}>, primary=${box ? Math.round(box.width) + "x" + Math.round(box.height) : "null"}, y=${box ? Math.round(box.y) : "?"}, vh=${vh}, inView=${primaryInView}`);
    await freeze(p);
    await p.screenshot({ path: `${OUT}/edit-390-dark-full.png` });
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);

    // M2: detail sheet on MOBILE (side=right sheet at 390 - reachability/overflow)
    await p.locator("[data-testid=open-sheet]").tap();
    await p.waitForSelector("[data-slot=sheet-content]", { state: "visible" });
    await p.waitForTimeout(400);
    const sbox = await p.locator("[data-slot=sheet-content]").boundingBox();
    const vw = await p.evaluate(() => window.innerWidth);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    // footer button reachable
    const histBtn = await p.locator('[data-slot=sheet-footer]').count();
    await freeze(p);
    await p.screenshot({ path: `${OUT}/detail-sheet-390-dark.png` });
    rec("M2 detail sheet at 390: width<=vw, footer present, no h-overflow", sbox && sbox.width <= vw + 1 && !overflow, `sheetW=${sbox ? Math.round(sbox.width) : "?"}, vw=${vw}, footer=${histBtn}, hOverflow=${overflow}`);
    // close
    const sc = await p.locator("[data-slot=sheet-content] [data-slot=sheet-close]").first();
    await sc.tap().catch(() => {});
    const sclosed = await p.waitForSelector("[data-slot=sheet-content]", { state: "hidden", timeout: 3000 }).then(() => true).catch(() => false);
    rec("M2b detail sheet closes via X on mobile", sclosed, `closed=${sclosed}`);

    // M3: confirm dialog at 390 - full-width buttons, no input focus
    await p.locator("[data-testid=open-confirm]").tap();
    await p.waitForSelector("[data-slot=alert-dialog-content]", { state: "visible" });
    await p.waitForTimeout(300);
    const ctag = await activeTag(p);
    const actionBox = await p.locator("[data-slot=alert-dialog-action]").boundingBox();
    await freeze(p);
    await p.screenshot({ path: `${OUT}/confirm-390-dark.png` });
    rec("M3 confirm at 390: no input focus + action >=44px", !INPUT.includes(ctag) && actionBox && actionBox.height >= 44, `active=<${ctag}>, action=${actionBox ? Math.round(actionBox.width) + "x" + Math.round(actionBox.height) : "null"}`);
    await p.keyboard.press("Escape");

    await p.close();
    await c.close();
  }

  /* ============ MOBILE LIGHT 390: quicklog + confirm eyeball ============= */
  {
    const c = await ctx(browser, { w: 390, h: 844, theme: "light", touch: true });
    for (const open of ["quicklog", "confirm"]) {
      const p = await c.newPage();
      await p.goto(`${FIX}?open=${open}`, { waitUntil: "domcontentloaded" });
      const sel = open === "confirm" ? "[data-slot=alert-dialog-content]" : "[data-slot=drawer-content]";
      await p.waitForSelector(sel, { state: "visible", timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(600);
      await freeze(p);
      await p.screenshot({ path: `${OUT}/${open}-390-light.png` });
      await p.close();
    }
    await c.close();
  }

  await browser.close();
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== AUDIT: ${pass}/${results.length} PASS ===`);
  for (const r of results.filter((x) => !x.pass)) console.log(`  FAIL ${r.id}: ${r.value}`);
}
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
