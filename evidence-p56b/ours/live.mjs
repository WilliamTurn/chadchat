import { chromium } from "@playwright/test";
import fs from "node:fs";

const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/ours";
const BASE = "http://localhost:3600";
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} :: ${name} :: ${detail}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.clearCookies();
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

try {
  // ---------- LOGIN ----------
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "claude-testing@example.com");
  await page.fill('input[type="password"]', "12345678");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  await page.waitForTimeout(1500);
  const loggedIn = !page.url().includes("/login");
  record("login succeeded", loggedIn, `url=${page.url()}`);

  // ---------- LIVE PAGE ----------
  await page.goto(`${BASE}/progress/training`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const finalUrl = page.url();
  record("progress/training reachable (not redirected to pricing/login)",
    finalUrl.includes("/progress/training"), `url=${finalUrl}`);

  const header = await page.getByRole("heading", { name: "Training", exact: true }).count();
  record("Training header renders", header > 0, `matches=${header}`);

  // What state? empty vs populated
  const totalSessionsTile = await page.getByText("Workouts logged").count();
  const emptyStateCta = await page.getByText(/Start your first workout|Finish your first workout|Lift something/i).count();
  const strengthCards = await page.locator('button[aria-expanded] .truncate.font-medium').count();
  record("live: status band / content present", totalSessionsTile > 0, `workoutsLoggedTile=${totalSessionsTile}`);
  console.log(`INFO live-state: strengthRecordCards=${strengthCards} emptyStateHints=${emptyStateCta}`);

  await page.screenshot({ path: `${OUT}/live-training-dark-1440.png`, fullPage: true });

  // Live heatmap overflow check (does the harness bug reproduce here?)
  const heatBox = await page.evaluate(() => {
    const heat = document.querySelector(".grid.flex-1.grid-rows-7")?.closest(".flex.min-w-0");
    if (!heat) return null;
    const r = heat.getBoundingClientRect();
    return { h: Math.round(r.height), w: Math.round(r.width) };
  });
  record("live: calendar heatmap height sane (<= 260px)",
    heatBox == null || heatBox.h <= 260,
    `heatmapBox=${JSON.stringify(heatBox)}`);

  // ---------- RANGE CONTROL ----------
  const rangeGroup = page.locator('[aria-label="Time range"]').first();
  const hasRange = await rangeGroup.count();
  record("live: range control (segmented) exists", hasRange > 0, `groups=${hasRange}`);
  if (hasRange > 0) {
    const btns = rangeGroup.getByRole("button");
    const labels = await btns.allInnerTexts();
    // Click a non-active segment; expect ?range= to appear.
    const before = page.url();
    // pick a middle preset
    const target = btns.nth(Math.min(1, (await btns.count()) - 1));
    await target.click();
    await page.waitForTimeout(600);
    const afterClick = page.url();
    const gotParam = /[?&]range=/.test(afterClick);
    record("live: clicking a segment sets ?range= in URL", gotParam,
      `labels=${JSON.stringify(labels)} before=${before} after=${afterClick}`);
    // Back restores
    await page.goBack({ waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(600);
    const afterBack = page.url();
    record("live: browser Back restores prior range URL", afterBack === before || !/[?&]range=/.test(afterBack),
      `afterBack=${afterBack}`);
    await page.goForward({ waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(400);
    const afterFwd = page.url();
    record("live: browser Forward re-applies range", /[?&]range=/.test(afterFwd), `afterFwd=${afterFwd}`);
  }

  // ---------- RECORD DRILL-DOWN (?pr=) ----------
  if (strengthCards > 0) {
    const firstCard = page.locator('button[aria-expanded]').first();
    const name = (await firstCard.locator(".truncate.font-medium").innerText().catch(() => "")).trim();
    await firstCard.click();
    await page.waitForTimeout(800);
    const urlPr = page.url();
    const hasPr = /[?&]pr=/.test(urlPr);
    const drillChart = await page.getByText(/estimated 1RM|est\. 1RM over time/i).count();
    const epley = await page.getByText(/Epley formula/i).count();
    record("live: opening a lift sets ?pr= and opens drill-down", hasPr && drillChart > 0,
      `lift="${name}" url=${urlPr} drillMatches=${drillChart}`);
    record("live: drill-down shows Epley formula caption", epley > 0, `epleyMatches=${epley}`);

    // View workout link inside drill-down
    const viewWorkout = page.locator('a[href^="/workouts/history/"]').first();
    const vwCount = await viewWorkout.count();
    if (vwCount > 0) {
      const href = await viewWorkout.getAttribute("href");
      const resp = await page.request.get(`${BASE}${href}`);
      record("live: record 'View workout' link resolves to real workout page (200)",
        resp.status() === 200 && /^\/workouts\/history\/.+/.test(href),
        `href=${href} status=${resp.status()}`);
    } else {
      record("live: record 'View workout' link present", false, "no /workouts/history/ link in drill-down");
    }

    // Back closes drill-down
    await page.goBack({ waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(600);
    const afterClosePr = !/[?&]pr=/.test(page.url());
    record("live: browser Back closes the drill-down (?pr removed)", afterClosePr, `url=${page.url()}`);
  } else {
    record("live: strength record cards present to drill into", false,
      "no record cards (account may have no workout data) — see INFO");
  }

  // ---------- TIMELINE ENTRY NAV ----------
  const timelineLink = page.locator('ol a[href^="/workouts/history/"]').first();
  if (await timelineLink.count() > 0) {
    const href = await timelineLink.getAttribute("href");
    const resp = await page.request.get(`${BASE}${href}`);
    record("live: timeline entry links to its workout page (200)",
      resp.status() === 200, `href=${href} status=${resp.status()}`);
  } else {
    record("live: timeline entry with workout link present", false, "no timeline workout links found");
  }

  record("live: no console errors", consoleErrors.length === 0,
    `errors=${JSON.stringify(consoleErrors.slice(0, 6))}`);

  // Dark 390 screenshot
  await page.setViewportSize({ width: 390, height: 800 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/live-training-dark-390.png`, fullPage: true });

  await ctx.close();

  // ---------- TOUCH TARGET (390 touch) ----------
  {
    const tctx = await browser.newContext({
      viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true,
      storageState: undefined,
    });
    // reuse login via fresh login
    const tp = await tctx.newPage();
    await tctx.clearCookies();
    await tp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await tp.fill('input[type="email"]', "claude-testing@example.com");
    await tp.fill('input[type="password"]', "12345678");
    await Promise.all([
      tp.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
      tp.getByRole("button", { name: /sign in/i }).click(),
    ]);
    await tp.waitForTimeout(1200);
    await tp.goto(`${BASE}/progress/training`, { waitUntil: "networkidle" });
    await tp.waitForTimeout(2000);
    const rg = tp.locator('[aria-label="Time range"]').first();
    if (await rg.count() > 0) {
      const heights = await rg.getByRole("button").evaluateAll((els) =>
        els.map((e) => Math.round(e.getBoundingClientRect().height)));
      const minH = Math.min(...heights);
      record("live(390 touch): range buttons >= 44px tall", minH >= 44,
        `heights=${JSON.stringify(heights)} min=${minH}`);
    } else {
      record("live(390 touch): range control present for touch sizing", false, "no range group");
    }
    await tctx.close();
  }

  // ---------- /workouts REGRESSION ----------
  {
    const wctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await wctx.clearCookies();
    const wp = await wctx.newPage();
    const wErrors = [];
    wp.on("console", (m) => { if (m.type() === "error") wErrors.push(m.text()); });
    wp.on("pageerror", (e) => wErrors.push("pageerror: " + e.message));
    await wp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await wp.fill('input[type="email"]', "claude-testing@example.com");
    await wp.fill('input[type="password"]', "12345678");
    await Promise.all([
      wp.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
      wp.getByRole("button", { name: /sign in/i }).click(),
    ]);
    await wp.waitForTimeout(1200);
    await wp.goto(`${BASE}/workouts`, { waitUntil: "networkidle" });
    await wp.waitForTimeout(2500);
    record("/workouts reachable", wp.url().includes("/workouts"), `url=${wp.url()}`);

    const volTitle = await wp.getByText("Training volume").count();
    const volHeadline = await wp.getByText(/Latest day/i).count();
    record("/workouts: 'Training volume' chart in new frame style", volTitle > 0 && volHeadline > 0,
      `title=${volTitle} headline=${volHeadline}`);

    // Calendar icon custom range picker
    const calBtn = wp.locator('button[aria-label="Pick a custom date range"]').first();
    const calCount = await calBtn.count();
    record("/workouts: custom-range calendar icon button present", calCount > 0, `count=${calCount}`);
    if (calCount > 0) {
      await calBtn.click();
      await wp.waitForTimeout(600);
      const fromLbl = await wp.getByText("From", { exact: true }).count();
      const toLbl = await wp.getByText("To", { exact: true }).count();
      record("/workouts: custom picker opens with From/To", fromLbl > 0 && toLbl > 0,
        `from=${fromLbl} to=${toLbl}`);
      await wp.keyboard.press("Escape");
      await wp.waitForTimeout(400);
      const closed = await wp.getByText("Custom date range").count();
      record("/workouts: custom picker closes", closed === 0, `stillOpenMatches=${closed}`);
    }

    // Screenshot volume + records
    await wp.screenshot({ path: `${OUT}/workouts-volume-records-1440.png`, fullPage: true });

    // Personal records drill-down + Epley
    const prCard = wp.locator('button[aria-expanded]').first();
    if (await prCard.count() > 0) {
      await prCard.scrollIntoViewIfNeeded();
      await prCard.click();
      await wp.waitForTimeout(800);
      const epley = await wp.getByText(/Epley formula/i).count();
      const est1rm = await wp.getByText(/estimated 1RM|est\. 1RM/i).count();
      record("/workouts: PR drill-down shows est. 1RM chart + Epley caption",
        epley > 0 && est1rm > 0, `epley=${epley} est1rm=${est1rm}`);
    } else {
      record("/workouts: personal record cards render", false, "no PR cards found");
    }

    record("/workouts: no console errors", wErrors.length === 0,
      `errors=${JSON.stringify(wErrors.slice(0, 6))}`);
    await wctx.close();
  }
} catch (e) {
  record("SCRIPT ERROR", false, String(e.stack || e));
} finally {
  await browser.close();
  fs.writeFileSync(`${OUT}/live-results.json`, JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass);
  console.log(`\n==== LIVE DONE: ${results.length - failed.length}/${results.length} passed ====`);
}
