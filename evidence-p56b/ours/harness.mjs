import { chromium } from "@playwright/test";
import fs from "node:fs";

const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/ours";
const URL = "http://localhost:3600/dev/fixtures/training";
const results = [];
function log(...a) { console.log(...a); }
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} :: ${name} :: ${detail}`);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => localStorage.setItem("theme", t), theme);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
}

const browser = await chromium.launch();
try {
  // ---------- THEME + WIDTH FULL-PAGE SCREENSHOTS ----------
  for (const theme of ["dark", "light"]) {
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(URL, { waitUntil: "networkidle" });
      await setTheme(page, theme);
      const htmlClass = await page.evaluate(() => document.documentElement.className);
      const isDark = htmlClass.includes("dark");
      await page.screenshot({ path: `${OUT}/harness-${theme}-${width}.png`, fullPage: true });
      record(`screenshot ${theme}@${width}`, theme === "dark" ? isDark : !isDark,
        `html class="${htmlClass}"`);
      await ctx.close();
    }
  }

  // ---------- STRUCTURE + CONSISTENT PERSONA (dark, 1440) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const netUnicorn = [];
    const consoleErrors = [];
    page.on("request", (r) => { if (r.url().includes("hiunicornstudio")) netUnicorn.push(r.url()); });
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
    await page.goto(URL, { waitUntil: "networkidle" });
    await setTheme(page, "dark");
    page.removeAllListeners("request");
    page.on("request", (r) => { if (r.url().includes("hiunicornstudio")) netUnicorn.push(r.url()); });

    // Six sections present
    const personaIds = ["first-run", "sparse", "consistent", "lapsed", "overshoot", "locked-basic"];
    for (const id of personaIds) {
      const count = await page.locator(`section[aria-label="${id}"]`).count();
      record(`persona section "${id}" renders`, count === 1, `count=${count}`);
    }

    const consistent = page.locator(`section[aria-label="consistent"]`);

    // Calendar heatmap filled cells (level>0 cells carry data-level or bg). Check
    // heatmap svg/cells presence + volume trend chart + adherence ring.
    const heatmapCells = await consistent.locator('[data-testid="heatmap-cell"], svg rect, [class*="heatmap"]').count();
    // Adherence "this week" text
    const adherenceThisWeek = await consistent.getByText(/this week/i).count();
    // Volume trend chart (svg path) inside a Training volume frame
    const volumeFrame = await consistent.getByText("Training volume").count();
    const svgCount = await consistent.locator("svg").count();
    record("consistent: adherence 'this week' present", adherenceThisWeek > 0, `matches=${adherenceThisWeek}`);
    record("consistent: 'Training volume' frame present", volumeFrame > 0, `matches=${volumeFrame}`);
    record("consistent: svg visuals render (charts)", svgCount > 3, `svgCount=${svgCount}, heatmapish=${heatmapCells}`);

    // Celebration hero headline
    const heroHeadline = consistent.getByText("New record: Barbell Bench Press", { exact: false });
    const heroCount = await heroHeadline.count();
    record("consistent: celebration hero 'New record: Barbell Bench Press'", heroCount > 0, `matches=${heroCount}`);

    // Milestone "10th workout logged"
    const milestone10 = await consistent.getByText(/10th workout/i).count();
    record("consistent: '10th workout' milestone present", milestone10 > 0, `matches=${milestone10}`);

    // ---------- DEDUP PROOF ----------
    // Strength records section: cards are buttons with a truncate font-medium name.
    // Find within consistent the "Strength and records" section's record buttons.
    const strengthSection = consistent.locator('section:has-text("Strength and records")');
    const recordNameNodes = strengthSection.locator('button[aria-expanded] .truncate.font-medium');
    const names = await recordNameNodes.allInnerTexts().catch(() => []);
    const benchCards = names.filter((n) => /bench/i.test(n));
    const exactlyOneBench = benchCards.length === 1 && benchCards[0].trim() === "Barbell Bench Press";
    record("DEDUP PROOF: exactly one bench card named 'Barbell Bench Press'",
      exactlyOneBench,
      `benchCards=${JSON.stringify(benchCards)} allNames=${JSON.stringify(names)}`);

    // ---------- CELEBRATION SCENE + WATERMARK ----------
    await heroHeadline.first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(6500);
    const usProjectCount = await page.locator("[data-us-project]").count();
    const canvasInHero = await page.locator("[data-us-project] canvas").count();
    const canvasDims = await page.locator("[data-us-project] canvas").first().boundingBox().catch(() => null);
    // Watermark detection: unicorn.studio free badge is an <a> to unicorn.studio
    // or visible text "unicorn.studio" / "Made in Unicorn".
    const watermarkAnchors = await page.locator('a[href*="unicorn.studio"], a[href*="unicornstudio"]').count();
    const watermarkText = await page.getByText(/unicorn\.?studio/i).count();
    record("celebration: unicorn SDK requested from cdn.jsdelivr.net/gh/hiunicornstudio",
      netUnicorn.length > 0, `requests=${JSON.stringify(netUnicorn)}`);
    record("celebration: scene canvas rendered", canvasInHero > 0,
      `data-us-project=${usProjectCount} canvas=${canvasInHero} dims=${JSON.stringify(canvasDims)}`);
    record("WATERMARK: no unicorn.studio watermark visible",
      watermarkAnchors === 0 && watermarkText === 0,
      `anchors=${watermarkAnchors} textMatches=${watermarkText}`);
    record("celebration: no console errors during scene load", consoleErrors.length === 0,
      `errors=${JSON.stringify(consoleErrors.slice(0, 5))}`);

    // Close-up screenshot of the hero
    const heroBox = consistent.locator('p[aria-live="polite"]').first();
    const heroContainer = heroBox.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await heroContainer.screenshot({ path: `${OUT}/celebration-hero-motion.png` }).catch(async () => {
      await page.screenshot({ path: `${OUT}/celebration-hero-motion-fallback.png` });
    });

    await ctx.close();
  }

  // ---------- REDUCED MOTION ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const netUnicorn = [];
    page.on("request", (r) => { if (r.url().includes("hiunicornstudio")) netUnicorn.push(r.url()); });
    await page.goto(URL, { waitUntil: "networkidle" });
    await setTheme(page, "dark");
    page.removeAllListeners("request");
    page.on("request", (r) => { if (r.url().includes("hiunicornstudio")) netUnicorn.push(r.url()); });
    const consistent = page.locator(`section[aria-label="consistent"]`);
    const hero = consistent.getByText("New record: Barbell Bench Press", { exact: false }).first();
    await hero.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(6500);
    const usProjectCount = await page.locator("[data-us-project]").count();
    const heroStillReads = await hero.count();
    record("REDUCED MOTION: NO unicorn SDK request", netUnicorn.length === 0,
      `requests=${JSON.stringify(netUnicorn)}`);
    record("REDUCED MOTION: scene div NOT mounted (data-us-project absent)", usProjectCount === 0,
      `data-us-project=${usProjectCount}`);
    record("REDUCED MOTION: hero still reads statically", heroStillReads > 0, `heroMatches=${heroStillReads}`);
    const heroContainer = consistent.locator('p[aria-live="polite"]').first()
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await heroContainer.screenshot({ path: `${OUT}/celebration-hero-reduced-motion.png` }).catch(() => {});
    await ctx.close();
  }

  // ---------- MOBILE HONESTY 390/360/320 ----------
  for (const width of [390, 360, 320]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 800 },
      hasTouch: true, isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    await setTheme(page, "dark");
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    const noOverflow = overflow.scrollWidth <= overflow.clientWidth;
    const activeTag = await page.evaluate(() => document.activeElement?.tagName || "NONE");
    const notInput = !["INPUT", "TEXTAREA"].includes(activeTag);
    record(`mobile ${width}: no horizontal overflow`, noOverflow,
      `scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} over=${overflow.scrollWidth - overflow.clientWidth}`);
    record(`mobile ${width}: no input focused on load`, notInput, `activeElement=${activeTag}`);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: `${OUT}/harness-mobile-${width}.png`, fullPage: true });
    }
    await ctx.close();
  }
} catch (e) {
  record("SCRIPT ERROR", false, String(e.stack || e));
} finally {
  await browser.close();
  fs.writeFileSync(`${OUT}/harness-results.json`, JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass);
  log(`\n==== HARNESS DONE: ${results.length - failed.length}/${results.length} passed ====`);
}
