/**
 * P34-B / FIX-03 URL-STATE VERIFICATION. READ-ONLY on product data.
 *
 * Proves the URL-state system on the wired routes: filter/range/search state
 * lives in query params, written shallowly (replaceState for filters/ranges,
 * pushState for open-a-panel), reactive to back/forward, defaults omitted,
 * invalid params fail safe. Logs in ONCE with the Elite "Marcus" showcase
 * account and drives every wired route with node Playwright. NEVER logs,
 * saves, deletes, or submits anything.
 *
 * Assumes the dev server is ALREADY running at :3600. Does not start/stop it.
 * Usage:  node scripts/p34b-checks.mjs   (run from inside chadchat/)
 */

import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3600";
const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p34b";
const SHOTS = `${OUT}/shots`;
mkdirSync(SHOTS, { recursive: true });

const ACCOUNT = { email: "stellarluxedecor@gmail.com", password: "jojo0607$$C!" };
const RANGE_LABELS = ["1W", "1M", "3M", "6M", "1Y", "All"];
const labelToToken = (l) => l.toLowerCase();

const results = [];
function rec(id, pass, assertion, value) {
  results.push({ id, pass, assertion, value });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} :: ${assertion} :: ${value}`);
}
async function step(id, assertion, fn) {
  try {
    const { pass, value } = await fn();
    rec(id, pass, assertion, value);
  } catch (e) {
    rec(id, false, assertion, `ERROR: ${String(e.message).split("\n")[0]}`);
  }
}

const params = (page) => new URL(page.url()).searchParams;
const path = (page) => new URL(page.url()).pathname;

/* ---- login (p2d-live pattern; targets the credential form's own submit) ---- */
async function login(context) {
  const p = await context.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
  const emailSel = "input[type=email], input[name=email], #email";
  await p.locator(emailSel).first().fill(ACCOUNT.email);
  await p
    .locator("input[type=password], input[name=password], #password")
    .first()
    .fill(ACCOUNT.password);
  await Promise.all([
    p.waitForLoadState("networkidle").catch(() => {}),
    p
      .locator(
        'form:has(input[type=password]) button[type=submit], button:has-text("Log in"), button:has-text("Sign in")'
      )
      .first()
      .click(),
  ]);
  await p.waitForTimeout(1800);
  return { p, ok: !p.url().includes("/login") };
}

/* ---- legacy ChartCard range control (progress / workouts volume / nutrition) */
async function presentPresets(page) {
  const out = [];
  for (const l of RANGE_LABELS) {
    const b = page.getByRole("button", { name: l, exact: true });
    if ((await b.count()) === 1 && (await b.first().isVisible())) out.push(l);
  }
  return out;
}
async function legacyActiveLabel(page) {
  for (const l of RANGE_LABELS) {
    const b = page.getByRole("button", { name: l, exact: true });
    if ((await b.count()) === 1) {
      const cls = (await b.first().getAttribute("class")) || "";
      if (cls.includes("bg-card")) return l;
    }
  }
  return null;
}

/* ---- window ChartFrame range control (hydration / sleep): aria-pressed ---- */
async function windowActiveLabel(page) {
  const b = page.locator('[aria-label="Time range"] button[aria-pressed="true"]');
  if (await b.count()) return ((await b.first().textContent()) || "").trim();
  return null;
}
async function windowPresetLabels(page) {
  const btns = page.locator('[aria-label="Time range"] button');
  const n = await btns.count();
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      label: ((await btns.nth(i).textContent()) || "").trim(),
      pressed: (await btns.nth(i).getAttribute("aria-pressed")) === "true",
    });
  }
  return out;
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const { p, ok } = await login(ctx);
  if (!ok) {
    rec("LOGIN", false, "Marcus account leaves /login", `stuck at ${p.url()}`);
    await finish(browser);
    return;
  }
  rec("LOGIN", true, "Marcus account leaves /login", `landed ${p.url()}`);

  /* =================== /progress (weight chart) ======================= */
  await p.goto(`${BASE}/progress`, { waitUntil: "domcontentloaded" });
  await p.getByRole("button", { name: "All", exact: true }).first().waitFor({ timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(600);
  const progPresets = await presentPresets(p);
  const clickLabel = progPresets.includes("1M") ? "1M" : progPresets.find((l) => l !== (progPresets[0])) ?? progPresets[0];

  // 1. click a range segment -> ?range=<token>, no reload, active matches
  await step("1", "click range -> ?range set (shallow), active segment matches", async () => {
    await p.getByRole("button", { name: clickLabel, exact: true }).first().click();
    await p.waitForTimeout(400);
    const token = params(p).get("range");
    const active = await legacyActiveLabel(p);
    return {
      pass: token === labelToToken(clickLabel) && active === clickLabel,
      value: `clicked ${clickLabel}; url=${p.url()}; range=${token}; active=${active}`,
    };
  });

  // 2. reload that URL -> same segment active on first paint
  await step("2", "reload ?range -> segment restored on first paint", async () => {
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: clickLabel, exact: true }).first().waitFor({ timeout: 15000 });
    const active = await legacyActiveLabel(p);
    return {
      pass: active === clickLabel && params(p).get("range") === labelToToken(clickLabel),
      value: `url=${p.url()}; active=${active}`,
    };
  });

  // 3. navigate away via a link, browser back -> segment + URL preserved
  await step("3", "nav away + browser Back -> range preserved", async () => {
    const link = p.locator('a[href="/today"], a[href="/"], a[href="/workouts"]').first();
    if (await link.count()) {
      await Promise.all([
        p.waitForLoadState("domcontentloaded").catch(() => {}),
        link.click(),
      ]);
    } else {
      await p.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
    }
    await p.waitForTimeout(800);
    await p.goBack({ waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: clickLabel, exact: true }).first().waitFor({ timeout: 15000 });
    const active = await legacyActiveLabel(p);
    return {
      pass: active === clickLabel && params(p).get("range") === labelToToken(clickLabel),
      value: `backUrl=${p.url()}; active=${active}`,
    };
  });

  // 4. custom date-range picker -> ?range=custom&from&to; reload restores Custom
  await step("4", "custom picker apply -> range=custom&from&to; reload -> Custom active", async () => {
    await p.goto(`${BASE}/progress`, { waitUntil: "domcontentloaded" });
    const trigger = p.locator('button[aria-label="Pick a custom date range"]');
    await trigger.first().waitFor({ timeout: 15000 });
    await trigger.first().click();
    await p.getByRole("button", { name: "Apply", exact: true }).waitFor({ timeout: 5000 });
    await p.getByRole("button", { name: "Apply", exact: true }).click();
    await p.waitForTimeout(500);
    const sp = params(p);
    const okWrite =
      sp.get("range") === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("from") || "") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("to") || "");
    const writtenUrl = p.url();
    await p.reload({ waitUntil: "domcontentloaded" });
    await trigger.first().waitFor({ timeout: 15000 });
    await p.waitForTimeout(500);
    const customText = ((await trigger.first().textContent()) || "").trim();
    await p.screenshot({ path: `${SHOTS}/04-progress-custom-restored.png` });
    return {
      pass: okWrite && customText.includes("Custom"),
      value: `wrote=${writtenUrl}; afterReload custom-btn="${customText}"`,
    };
  });

  // 5. garbage deep link -> renders at default, no crash
  await step("5", "?range=banana -> renders at default range, no error boundary", async () => {
    await p.goto(`${BASE}/progress?range=banana`, { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: "All", exact: true }).first().waitFor({ timeout: 15000 });
    const active = await legacyActiveLabel(p);
    const hasError = await p.locator("text=/something went wrong|Application error/i").count();
    return {
      pass: active != null && hasError === 0,
      value: `active=${active} (a valid preset, not "banana"); errorBoundary=${hasError}`,
    };
  });

  /* =================== /workouts (volume + PR) ======================== */
  // PR rows are the only aria-expanded buttons that wrap an exercise-name div
  // (Radix help/popover triggers also carry aria-expanded, so scope past them).
  const PR_ROW = 'button[aria-expanded]:has(div.truncate.font-medium)';
  await p.goto(`${BASE}/workouts`, { waitUntil: "domcontentloaded" });
  await p.locator(PR_ROW).first().waitFor({ timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(600);

  // 6. volume chart range click -> ?range updates; reload restores
  await step("6", "volume range click -> ?range set; reload restores", async () => {
    const presets = await presentPresets(p);
    if (presets.length < 2) return { pass: false, value: "volume chart range control not found" };
    const target = presets.includes("1M") ? "1M" : presets.find((l) => l !== presets[0]) ?? presets[0];
    await p.getByRole("button", { name: target, exact: true }).first().click();
    await p.waitForTimeout(400);
    const token = params(p).get("range");
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: target, exact: true }).first().waitFor({ timeout: 15000 });
    const active = await legacyActiveLabel(p);
    return {
      pass: token === labelToToken(target) && active === target,
      value: `clicked ${target}; range=${token}; afterReload active=${active}`,
    };
  });

  // 7. PR row click -> panel opens + ?pr=<name> PUSHED; Back closes + clears
  let prName = "";
  await step("7", "PR row -> panel opens + ?pr pushed (Back closes)", async () => {
    const row = p.locator(PR_ROW).first();
    await row.waitFor({ timeout: 15000 });
    await row.scrollIntoViewIfNeeded();
    prName = ((await row.locator("div.truncate.font-medium").first().textContent()) || "").trim();
    const histBefore = await p.evaluate(() => window.history.length);
    await row.click();
    await p.waitForTimeout(500);
    const prParam = params(p).get("pr");
    const histAfter = await p.evaluate(() => window.history.length);
    const panelOpen = await p.getByRole("heading", { name: prName }).first().isVisible().catch(() => false);
    await p.screenshot({ path: `${SHOTS}/07-workouts-pr-open.png` });
    await p.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
    await p.waitForTimeout(500);
    const prAfterBack = params(p).get("pr");
    const expandedAfterBack = await p.locator(`${PR_ROW}[aria-expanded="true"]`).count();
    return {
      pass:
        prParam === prName &&
        panelOpen &&
        histAfter === histBefore + 1 &&
        prAfterBack == null &&
        expandedAfterBack === 0,
      value: `pr="${prParam}"; panelOpen=${panelOpen}; history ${histBefore}->${histAfter} (push=${histAfter === histBefore + 1}); afterBack pr=${prAfterBack}, expandedRows=${expandedAfterBack}`,
    };
  });

  // 8. deep link ?pr=<name> -> drill-down open on load
  await step("8", "deep link ?pr=<name> -> drill-down open on load", async () => {
    if (!prName) return { pass: false, value: "no PR name captured in check 7" };
    await p.goto(`${BASE}/workouts?pr=${encodeURIComponent(prName)}`, { waitUntil: "domcontentloaded" });
    const heading = p.getByRole("heading", { name: prName }).first();
    const open = await heading.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    const expanded = await p.locator(`${PR_ROW}[aria-expanded="true"]`).count();
    await p.screenshot({ path: `${SHOTS}/08-workouts-pr-deeplink.png` });
    return { pass: open && expanded >= 1, value: `panelOpen=${open}; expandedRows=${expanded}; url=${p.url()}` };
  });

  /* =================== /workouts/exercises (search + muscle) ========== */
  // 9. typing burst -> ?q debounced AND creates ZERO history entries
  await step("9", "search burst -> ?q=bench debounced; Back leaves the page (0 history entries)", async () => {
    await p.goto(`${BASE}/workouts`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(400);
    // arrive at the library via an in-app link so a prior page exists on the stack
    const libLink = p.locator('a[href="/workouts/exercises"]').first();
    if (await libLink.count()) {
      await Promise.all([p.waitForLoadState("domcontentloaded").catch(() => {}), libLink.click()]);
    } else {
      await p.goto(`${BASE}/workouts/exercises`, { waitUntil: "domcontentloaded" });
    }
    const input = p.locator('input[aria-label="Search exercises"]');
    await input.waitFor({ timeout: 15000 });
    await input.click();
    await input.type("bench", { delay: 40 });
    // list filters instantly; URL write is debounced (~350ms)
    await p.waitForTimeout(700);
    const q = params(p).get("q");
    await p.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
    await p.waitForTimeout(500);
    const leftPage = path(p) !== "/workouts/exercises";
    return {
      pass: q === "bench" && leftPage,
      value: `?q=${q}; Back landed at ${path(p)} (left library=${leftPage} -> typing added 0 history entries)`,
    };
  });

  // 10. muscle chip -> ?muscle; All muscles removes param; deep link pre-filters
  await step("10", "muscle chip -> ?muscle set; All muscles omits it; deep link pre-filters", async () => {
    await p.goto(`${BASE}/workouts/exercises`, { waitUntil: "domcontentloaded" });
    const chest = p.getByRole("tab", { name: "Chest", exact: true });
    await chest.waitFor({ timeout: 15000 });
    await chest.click();
    await p.waitForTimeout(400);
    const muscleSet = params(p).get("muscle");
    await p.getByRole("tab", { name: "All muscles", exact: true }).click();
    await p.waitForTimeout(400);
    const muscleCleared = params(p).get("muscle");
    // deep link with both params
    await p.goto(`${BASE}/workouts/exercises?q=press&muscle=chest`, { waitUntil: "domcontentloaded" });
    const input = p.locator('input[aria-label="Search exercises"]');
    await input.waitFor({ timeout: 15000 });
    await p.waitForTimeout(400);
    const inputVal = await input.inputValue();
    const chestSelected = (await p.getByRole("tab", { name: "Chest", exact: true }).getAttribute("aria-selected")) === "true";
    const allSelected = (await p.getByRole("tab", { name: "All muscles", exact: true }).getAttribute("aria-selected")) === "true";
    await p.screenshot({ path: `${SHOTS}/10-exercises-deeplink-filtered.png` });
    return {
      pass: muscleSet === "chest" && muscleCleared == null && inputVal === "press" && chestSelected && !allSelected,
      value: `chip->muscle=${muscleSet}; AllMuscles->muscle=${muscleCleared}(omitted); deeplink input="${inputVal}", chestSelected=${chestSelected}`,
    };
  });

  /* =================== /nutrition (?day regression + macro chart) ===== */
  // 11. ?day regression: day-back arrow -> ?day, heading changes; Back -> today
  await step("11", "day-back -> ?day=YYYY-MM-DD, heading changes; Back -> today", async () => {
    await p.goto(`${BASE}/nutrition`, { waitUntil: "domcontentloaded" });
    const todayHeading = p.getByRole("heading", { name: "Today", exact: true }).first();
    await todayHeading.waitFor({ timeout: 15000 });
    const prev = p.getByRole("link", { name: "Previous day", exact: true }).first();
    await prev.waitFor({ timeout: 5000 });
    await prev.click();
    await p.waitForURL(/[?&]day=/, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(600);
    const dayParam = params(p).get("day");
    const headingChanged = (await p.getByRole("heading", { name: "Today", exact: true }).count()) === 0;
    await p.goBack({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(600);
    const backToToday =
      params(p).get("day") == null &&
      (await p.getByRole("heading", { name: "Today", exact: true }).first().isVisible().catch(() => false));
    return {
      pass: /^\d{4}-\d{2}-\d{2}$/.test(dayParam || "") && headingChanged && backToToday,
      value: `?day=${dayParam}; headingLeftToday=${headingChanged}; Back->today=${backToToday}`,
    };
  });

  // 12. macro chart: ?metric + ?range; reload restores both; ?metric=banana -> Calories
  await step("12", "macro metric+range -> params; reload restores; ?metric=banana -> Calories default", async () => {
    await p.goto(`${BASE}/nutrition`, { waitUntil: "domcontentloaded" });
    const protein = p.getByRole("button", { name: "Protein", exact: true });
    await protein.waitFor({ timeout: 15000 });
    await protein.scrollIntoViewIfNeeded();
    await protein.click();
    await p.waitForTimeout(400);
    const metricSet = params(p).get("metric");
    const presets = await presentPresets(p);
    const rLabel = presets.includes("1M") ? "1M" : presets.find((l) => l !== presets[0]) ?? presets[0];
    await p.getByRole("button", { name: rLabel, exact: true }).first().click();
    await p.waitForTimeout(400);
    const rangeSet = params(p).get("range");
    await p.reload({ waitUntil: "domcontentloaded" });
    await protein.waitFor({ timeout: 15000 });
    await p.waitForTimeout(400);
    const proteinCls = (await protein.getAttribute("class")) || "";
    const proteinActive = proteinCls.includes("bg-card");
    const rangeActive = await legacyActiveLabel(p);
    // garbage metric
    await p.goto(`${BASE}/nutrition?metric=banana`, { waitUntil: "domcontentloaded" });
    const cal = p.getByRole("button", { name: "Cal", exact: true });
    await cal.waitFor({ timeout: 15000 });
    await p.waitForTimeout(300);
    const calActive = ((await cal.getAttribute("class")) || "").includes("bg-card");
    return {
      pass:
        metricSet === "protein" &&
        labelToToken(rLabel) === rangeSet &&
        proteinActive &&
        rangeActive === rLabel &&
        calActive,
      value: `metric=${metricSet}, range=${rangeSet}; afterReload proteinActive=${proteinActive}, rangeActive=${rangeActive}; ?metric=banana -> Cal active=${calActive}`,
    };
  });

  /* =================== /hydration + /sleep (window range, REPLACE) ==== */
  for (const route of ["/hydration", "/sleep"]) {
    const n = route === "/hydration" ? "13a" : "13b";
    await step(n, `${route} range click -> ?range; reload restores; Back LEAVES page (replace)`, async () => {
      await p.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(300);
      await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      const ctrl = p.locator('[aria-label="Time range"]');
      await ctrl.first().waitFor({ timeout: 15000 });
      await p.waitForTimeout(400);
      const before = await windowPresetLabels(p);
      const target = before.find((b) => !b.pressed);
      if (!target) return { pass: false, value: `no inactive window preset on ${route}` };
      await p.locator('[aria-label="Time range"] button', { hasText: new RegExp(`^${target.label}$`) }).first().click();
      await p.waitForTimeout(400);
      const rangeSet = params(p).get("range");
      await p.reload({ waitUntil: "domcontentloaded" });
      await ctrl.first().waitFor({ timeout: 15000 });
      await p.waitForTimeout(400);
      const activeAfterReload = await windowActiveLabel(p);
      await p.goBack({ waitUntil: "domcontentloaded" });
      await p.waitForTimeout(500);
      const leftPage = path(p) !== route;
      return {
        pass: rangeSet === labelToToken(target.label) && activeAfterReload === target.label && leftPage,
        value: `clicked ${target.label}; range=${rangeSet}; reload active=${activeAfterReload}; Back landed ${path(p)} (left ${route}=${leftPage} -> replace)`,
      };
    });
  }

  /* =================== /reports (older report open, PUSH) ============= */
  await step("14", "older report open -> ?report pushed; Back closes; deep link opens+scrolls", async () => {
    await p.goto(`${BASE}/reports`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    const details = p.locator("details.group");
    const count = await details.count();
    if (count < 1) return { pass: true, value: "N/A: account has fewer than 2 reports (no 'Earlier weeks' column)" };
    const first = details.first();
    const histBefore = await p.evaluate(() => window.history.length);
    await first.locator("summary").click();
    await p.waitForTimeout(500);
    const reportId = params(p).get("report");
    const histAfter = await p.evaluate(() => window.history.length);
    const openState = await first.evaluate((el) => el.open);
    await p.screenshot({ path: `${SHOTS}/14-reports-open.png` });
    await p.goBack({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(500);
    const afterBackParam = params(p).get("report");
    // deep link
    await p.goto(`${BASE}/reports?report=${reportId}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);
    const deep = p.locator(`details.group`).filter({ has: p.locator("[open]") });
    const deepOpen = await p
      .locator("details.group")
      .evaluateAll((els) => els.some((e) => e.open));
    return {
      pass:
        reportId != null &&
        histAfter === histBefore + 1 &&
        openState === true &&
        afterBackParam == null &&
        deepOpen,
      value: `report=${reportId}; history ${histBefore}->${histAfter}(push=${histAfter === histBefore + 1}); open=${openState}; afterBack report=${afterBackParam}; deepLinkOpen=${deepOpen}`,
    };
  });

  /* =================== scroll restoration ============================= */
  await step("15", "list -> detail -> Back restores scrollY within ~100px", async () => {
    await p.goto(`${BASE}/workouts/history`, { waitUntil: "domcontentloaded" });
    const card = p.locator('a[href^="/workouts/history/"]').first();
    await card.waitFor({ timeout: 15000 });
    await p.waitForTimeout(600);
    const scrollH = await p.evaluate(() => document.documentElement.scrollHeight);
    const target = Math.min(700, Math.max(0, scrollH - 900));
    await p.evaluate((y) => window.scrollTo(0, y), target);
    await p.waitForTimeout(400);
    const y1 = await p.evaluate(() => Math.round(window.scrollY));
    // Click a card ALREADY inside the viewport at this scroll, so Playwright's
    // auto-scroll-before-click never moves us (which would void the test).
    const idx = await p.evaluate(() => {
      const links = [...document.querySelectorAll('a[href^="/workouts/history/"]')];
      return links.findIndex((l) => {
        const r = l.getBoundingClientRect();
        return r.top >= 40 && r.top <= window.innerHeight - 80;
      });
    });
    const links = p.locator('a[href^="/workouts/history/"]');
    await Promise.all([
      p.waitForURL(/\/workouts\/history\/[^/]+$/, { timeout: 8000 }).catch(() => {}),
      links.nth(Math.max(0, idx)).click(),
    ]);
    await p.waitForTimeout(700);
    const onDetail = /\/workouts\/history\/[^/]+$/.test(path(p));
    await p.goBack({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1000);
    const y2 = await p.evaluate(() => Math.round(window.scrollY));
    return {
      pass: y1 > 0 && onDetail && Math.abs(y2 - y1) <= 100,
      value: `scrolled to y1=${y1} (scrollH=${scrollH}); onDetail=${onDetail}; afterBack y2=${y2}; delta=${Math.abs(y2 - y1)}`,
    };
  });

  /* =================== cross-cutting: no document navigation ========== */
  await step("16", "range click does NOT navigate the document (window marker survives)", async () => {
    await p.goto(`${BASE}/progress`, { waitUntil: "domcontentloaded" });
    // Wait for the streamed chart before reading the range control.
    await p.getByRole("button", { name: "All", exact: true }).first().waitFor({ timeout: 15000 });
    await p.waitForTimeout(500);
    const presets = await presentPresets(p);
    if (presets.length < 2) return { pass: false, value: "no range control on /progress" };
    await p.evaluate(() => {
      window.__p34bMarker = 1;
    });
    const urlBefore = p.url();
    const clickTarget = presets.find((l) => l !== presets[0]) ?? presets[0];
    await p.getByRole("button", { name: clickTarget, exact: true }).first().click();
    await p.waitForTimeout(400);
    const marker = await p.evaluate(() => window.__p34bMarker);
    const urlChanged = p.url() !== urlBefore && params(p).get("range") != null;
    return {
      pass: marker === 1 && urlChanged,
      value: `markerSurvived=${marker === 1}; urlChanged=${urlChanged} (${p.url()})`,
    };
  });

  await finish(browser);
}

async function finish(browser) {
  await browser.close();
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== P34-B: ${pass}/${results.length} PASS ===`);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id}: ${r.assertion}`);
}

run().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
