// FIX-10 cross-surface refresh proof (P2-Z Hydration pilot, DSH-66).
// Proves: logging water on /today revalidates /hydration so a CLIENT-SIDE
// nav to /hydration shows fresh data with NO manual reload (mutation receipt).
//
// Run:  node evidence-p34c/p34c-refresh-proof.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = "http://localhost:3600";
const EMAIL = "claude-testing@example.com";
const PASSWORD = "12345678";
const LOG_OZ = 33; // distinctive custom amount (odd, not a preset), round-trips exactly

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
}

const shot = (page, file) => page.screenshot({ path: join(OUT, file), fullPage: false });

// Parse the WaterTracker vessel aria-label on /hydration into today's oz total.
// e.g. "Hydration 25% of goal: 33 oz of 1 gal, 95 oz to go." / "...reached: 128 oz of 1 gal."
async function readHydrationTotalOz(page) {
  const img = page.getByRole("img", { name: /Hydration/ }).first();
  await img.waitFor({ state: "visible", timeout: 15000 });
  const label = await img.getAttribute("aria-label");
  const m = label && label.match(/(?:goal:|reached:)\s*(\d+)\s*oz of/i);
  if (!m) throw new Error("could not parse hydration total from: " + label);
  return { oz: Number(m[1]), label };
}

// Read the /today HydrationPanel headline oz ("Water" panel).
async function readTodayPanelOz(page) {
  // The panel headline renders the oz total as text like "40 oz" near the
  // "Water" title. Grab it from the panel region.
  const oz = await page.evaluate(() => {
    const heads = Array.from(document.querySelectorAll("*")).filter(
      (el) => el.textContent && el.textContent.trim() === "Water" && el.children.length === 0
    );
    for (const h of heads) {
      // walk up to the panel card, then find the big oz headline within
      let card = h;
      for (let i = 0; i < 6 && card.parentElement; i++) card = card.parentElement;
      const txt = card.textContent || "";
      const m = txt.match(/(\d+)\s*oz/);
      if (m) return Number(m[1]);
    }
    // fallback: first "NN oz" on page
    const bm = document.body.textContent.match(/(\d+)\s*oz/);
    return bm ? Number(bm[1]) : null;
  });
  return oz;
}

const consoleErrors = [];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

  try {
    // ---- 1. LOGIN ----
    // The login form is a client onSubmit over a noValidate <form>; clicking
    // before React hydrates the handler causes a NATIVE GET submit (creds land
    // in the query string, no auth). So wait for hydration, and retry if we
    // detect the native-submit race.
    let afterLogin = "/login";
    for (let attempt = 1; attempt <= 4 && afterLogin.startsWith("/login"); attempt++) {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500 * attempt); // give the bundle time to hydrate
      await page.locator('input[type="email"]').fill(EMAIL);
      await page.locator('input[type="password"]').first().fill(PASSWORD);
      // Success = the server-action POST fires. If the native GET wins instead,
      // the URL gains ?email=...; treat that as a miss and retry.
      await page.getByRole("button", { name: /^Sign in$/ }).click();
      for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(1000);
        const u = new URL(page.url());
        if (!u.pathname.startsWith("/login")) break;
        if (u.searchParams.has("email")) {
          console.log(`[login] attempt ${attempt}: native GET submit race, retrying`);
          break;
        }
      }
      afterLogin = new URL(page.url()).pathname;
      if (!afterLogin.startsWith("/login")) break;
    }
    check("Login succeeds (left /login)", !afterLogin.startsWith("/login"), `url=${afterLogin}`);

    // ---- 2. /hydration : record baseline total ----
    await page.goto(`${BASE}/hydration`, { waitUntil: "networkidle" });
    if (new URL(page.url()).pathname.startsWith("/login")) {
      throw new Error("bounced to /login on /hydration — not authenticated");
    }
    const base = await readHydrationTotalOz(page);
    await shot(page, "refresh-01-hydration-before.png");
    console.log(`[baseline] /hydration total = ${base.oz} oz  (aria="${base.label}")`);

    // Plant a client-nav sentinel: survives a soft nav, wiped by a hard reload.
    await page.evaluate(() => {
      window.__navSentinel = "alive";
    });

    // ---- 3. CLIENT-SIDE nav to /today, then log water in the pilot panel ----
    await page.locator('a[href="/today"]').first().click();
    await page.waitForFunction(() => location.pathname === "/today", null, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    const softNav1 = await page.evaluate(() => window.__navSentinel === "alive");
    check("/hydration→/today was a client-side nav (no hard reload)", softNav1);

    // record the /today panel total before logging (should equal baseline)
    const todayBefore = await readTodayPanelOz(page);
    console.log(`[/today] Water panel before log = ${todayBefore} oz`);
    check(
      "/today Water panel matches /hydration baseline on arrival",
      todayBefore === base.oz,
      `today=${todayBefore} vs hydration=${base.oz}`
    );

    // open the quick-log overlay and log a distinctive custom amount
    await page.getByRole("button", { name: /^Log water$/ }).first().scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /^Log water$/ }).first().click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 8000 });
    // custom amount field inside the dialog
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[inputmode="numeric"]').fill(String(LOG_OZ));
    await dialog.getByRole("button", { name: /Add water/i }).click();

    // success = sonner receipt toast "Added 33 oz. ..."
    await page
      .getByText(new RegExp(`Added ${LOG_OZ} oz`, "i"))
      .first()
      .waitFor({ state: "visible", timeout: 12000 });
    await page.waitForTimeout(1200); // let optimistic + server settle
    await shot(page, "refresh-02-today-logged.png");

    const todayAfter = await readTodayPanelOz(page);
    console.log(`[/today] Water panel after log = ${todayAfter} oz`);
    check(
      `Step 5: /today panel reflects new total immediately (+${LOG_OZ} oz)`,
      todayAfter === base.oz + LOG_OZ,
      `after=${todayAfter}, expected=${base.oz + LOG_OZ}`
    );

    // ---- 4. CLIENT-SIDE nav back to /hydration, assert increased ----
    // fresh sentinel to prove this hop is also soft
    await page.evaluate(() => {
      window.__navSentinel2 = "alive";
    });
    await page.locator('a[href="/hydration"]').first().click();
    await page.waitForFunction(() => location.pathname === "/hydration", null, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    const softNav2 = await page.evaluate(() => window.__navSentinel2 === "alive");
    check("/today→/hydration was a client-side nav (no hard reload)", softNav2);

    const after = await readHydrationTotalOz(page);
    console.log(`[/hydration] total after log = ${after.oz} oz  (aria="${after.label}")`);
    await shot(page, "refresh-03-hydration-after.png");
    check(
      `Step 4: /hydration total increased by ${LOG_OZ} oz after client-side nav (FIX-10 receipt)`,
      after.oz === base.oz + LOG_OZ,
      `after=${after.oz}, expected=${base.oz + LOG_OZ}`
    );

    // new entry visible in Today's log
    const entryVisible = await page
      .getByText(new RegExp(`^${LOG_OZ} oz$`))
      .first()
      .isVisible()
      .catch(() => false);
    check("New entry appears in /hydration Today's log", entryVisible, `${LOG_OZ} oz row visible=${entryVisible}`);

    // ---- 6. CLEANUP: delete the exact entry via named confirm dialog ----
    // Find the Today's log row containing our amount, click its Delete.
    const row = page
      .locator("div")
      .filter({ hasText: new RegExp(`^\\s*${LOG_OZ} oz`) })
      .filter({ has: page.getByRole("button", { name: "Delete" }) })
      .first();
    let deleted = false;
    if (await row.count()) {
      await row.getByRole("button", { name: "Delete" }).first().click();
    } else {
      // fallback: the last Delete button in Today's log
      await page.getByRole("button", { name: "Delete" }).last().click();
    }
    const confirm = page.getByRole("alertdialog");
    await confirm.waitFor({ state: "visible", timeout: 8000 });
    const confirmTitle = await confirm.getByRole("heading").first().textContent().catch(() => null);
    console.log(`[cleanup] confirm dialog: "${confirmTitle}"`);
    await confirm.getByRole("button", { name: /Delete entry/i }).click();
    await page.waitForTimeout(1500);
    await page.waitForLoadState("networkidle");
    deleted = true;

    const restored = await readHydrationTotalOz(page);
    console.log(`[/hydration] total after cleanup = ${restored.oz} oz`);
    await shot(page, "refresh-04-cleanup.png");
    check(
      "Step 6: cleanup deleted our entry; total returned to baseline",
      restored.oz === base.oz,
      `restored=${restored.oz}, baseline=${base.oz}`
    );

    // safety: make sure no stray 33oz row remains
    const stillThere = await page
      .getByText(new RegExp(`^${LOG_OZ} oz$`))
      .first()
      .isVisible()
      .catch(() => false);
    check("No leftover test entry remains after cleanup", !stillThere, `residual ${LOG_OZ}oz row visible=${stillThere}`);

    // summary object for the report
    const summary = {
      baselineOz: base.oz,
      loggedOz: LOG_OZ,
      todayAfterOz: todayAfter,
      hydrationAfterOz: after.oz,
      restoredOz: restored.oz,
      confirmTitle,
      consoleErrors,
    };
    console.log("\n=== SUMMARY JSON ===\n" + JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error("SCRIPT ERROR:", err && err.stack ? err.stack : err);
    await shot(page, "refresh-ERROR.png").catch(() => {});
    check("Script completed without fatal error", false, String(err && err.message));
  } finally {
    console.log("\n=== CONSOLE ERRORS (" + consoleErrors.length + ") ===");
    for (const e of consoleErrors.slice(0, 30)) console.log(" -", e);
    console.log("\n=== VERDICTS ===");
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} — ${r.name}`);
    const failed = results.filter((r) => !r.pass).length;
    console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${results.length} checks)`);
    await browser.close();
    process.exit(failed === 0 ? 0 : 1);
  }
})();
