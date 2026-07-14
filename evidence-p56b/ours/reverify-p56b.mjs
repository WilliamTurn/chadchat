import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3600";
const OURS = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/ours";
const SHOT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/mobile-audit";

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "claude-testing@example.com");
  await page.fill('input[type="password"]', "12345678");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  await page.waitForTimeout(1500);
}

// ---- Check 1 measure: celebration hero text block + button ----
const HERO = () => {
  const textBlock = document.querySelector(".basis-52");
  if (!textBlock) return { found: false };
  const tb = textBlock.getBoundingClientRect();
  const hero = textBlock.closest(".rounded-2xl");
  const btn = hero
    ? [...hero.querySelectorAll("a,button")].find((el) =>
        /View the workout/i.test(el.textContent || "")
      )
    : null;
  const bb = btn ? btn.getBoundingClientRect() : null;
  const headline = (textBlock.querySelector("p")?.textContent || "").trim();
  return {
    found: true,
    textW: Math.round(tb.width),
    textTop: Math.round(tb.top),
    textBottom: Math.round(tb.bottom),
    textRight: Math.round(tb.right),
    headline,
    btnFound: !!btn,
    btnTop: bb ? Math.round(bb.top) : null,
    btnLeft: bb ? Math.round(bb.left) : null,
    below: bb ? bb.top >= tb.bottom - 2 : null,
    beside: bb ? bb.left >= tb.right - 8 : null,
  };
};

// ---- Check 2 measure: recharts y-axis tick texts inside a titled ChartFrame ----
const YAXIS = (title) => {
  const h = [...document.querySelectorAll("h3")].find(
    (n) => (n.textContent || "").trim() === title
  );
  const card = h ? h.closest("figure") : null;
  if (!card) return { found: false };
  const yAxis = card.querySelector(".recharts-yAxis");
  const ticks = yAxis
    ? [...yAxis.querySelectorAll(".recharts-cartesian-axis-tick-value")]
        .map((t) => (t.textContent || "").trim())
        .filter(Boolean)
    : [];
  return { found: !!yAxis, ticks };
};

const tickPass = (ticks) =>
  ticks.length > 0 &&
  ticks.every((t) => t.length < 4 || /k$/.test(t));

// ---- Check 4 measure: adherence weekly rings inside a persona section ----
const ADHERENCE = (personaLabel) => {
  const section = document.querySelector(
    `section[aria-label="${personaLabel}"]`
  );
  if (!section) return { found: false, reason: "no section" };
  const h = [...section.querySelectorAll("h3")].find(
    (n) => (n.textContent || "").trim() === "Plan adherence"
  );
  const card = h ? h.closest("figure") : null;
  if (!card) return { found: false, reason: "no adherence card" };
  const cr = card.getBoundingClientRect();
  // The weekly rings row: the flex-wrap items-end container of small rings.
  const rows = [...card.querySelectorAll(".flex.flex-wrap.items-end")];
  const row = rows[0];
  // label above the weekly rings
  const labelEl = [...card.querySelectorAll("span")].find((s) =>
    /^(This week|Last \d+ weeks)$/.test((s.textContent || "").trim())
  );
  const label = labelEl ? (labelEl.textContent || "").trim() : null;
  if (!row) return { found: false, reason: "no weekly row", label };
  // Each weekly ring = the RingGauge div (inline-flex with fixed px width/height).
  const rings = [...row.querySelectorAll("svg")].map((svg) => {
    const r = svg.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
  });
  const cardRight = Math.round(cr.right);
  const maxRight = rings.reduce((m, r) => Math.max(m, r.right), 0);
  const rightmost = rings[rings.length - 1] || null;
  return {
    found: true,
    label,
    ringCount: rings.length,
    cardRight,
    maxRingRight: maxRight,
    allInside: rings.every((r) => r.right <= cardRight + 1),
    rightmostRight: rightmost ? rightmost.right : null,
    rightmostInside: rightmost ? rightmost.right <= cardRight + 1 : null,
    rings,
  };
};

const results = { check1: {}, check2: {}, check3: {}, check4: {}, label: {} };
const browser = await chromium.launch();

try {
  // ============ CHECK 1: CELEBRATION HERO (390 + 360) ============
  for (const width of [390, 360]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 844 },
    });
    await ctx.clearCookies();
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/progress/training`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    // scroll the hero into view so screenshot/layout is settled
    await page.evaluate(() => {
      const tb = document.querySelector(".basis-52");
      if (tb) tb.closest(".rounded-2xl")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(400);
    results.check1[width] = await page.evaluate(HERO);
    if (width === 390) {
      await page.screenshot({ path: `${SHOT}/fixed-hero-390w.png` });
    }
    await ctx.close();
  }

  // ============ CHECK 2: VOLUME Y-AXIS (390) ============
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.clearCookies();
    const page = await ctx.newPage();
    await login(page);

    // /workouts
    await page.goto(`${BASE}/workouts`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const h = [...document.querySelectorAll("h3")].find(
        (n) => (n.textContent || "").trim() === "Training volume"
      );
      h?.closest("figure")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(600);
    results.check2.workouts = await page.evaluate(YAXIS, "Training volume");
    await page.screenshot({ path: `${SHOT}/fixed-volume-axis-390w.png` });

    // /progress/training
    await page.goto(`${BASE}/progress/training`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const h = [...document.querySelectorAll("h3")].find(
        (n) => (n.textContent || "").trim() === "Training volume"
      );
      h?.closest("figure")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(600);
    results.check2.progress = await page.evaluate(YAXIS, "Training volume");

    await ctx.close();
  }

  // ============ CHECK 3: DRILL-DOWN SCROLL-INTO-VIEW (390 touch) ============
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await ctx.clearCookies();
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/workouts`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    // Scroll so the Personal records grid top sits at viewport top.
    await page.evaluate(() => {
      const h = [...document.querySelectorAll("h2")].find((n) =>
        /Personal records/i.test(n.textContent || "")
      );
      const grid = h
        ? h.parentElement?.querySelector(".grid")
        : document.querySelector(".grid");
      const target = grid || h;
      if (target) {
        const y = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, y);
      }
    });
    await page.waitForTimeout(400);

    const beforeH = page.viewportSize().height;
    // tap first record card
    const firstCard = page.locator("button[aria-expanded]").first();
    const cardCount = await page.locator("button[aria-expanded]").count();
    await firstCard.tap();
    await page.waitForTimeout(900);

    results.check3 = await page.evaluate((vh) => {
      const panel = document.querySelector("section.overflow-hidden");
      if (!panel) return { found: false };
      const r = panel.getBoundingClientRect();
      return {
        found: true,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        viewportH: vh,
        intersects: r.top < vh && r.bottom > 0,
      };
    }, beforeH);
    results.check3.cardCount = cardCount;
    await page.screenshot({ path: `${SHOT}/fixed-drilldown-390w.png` });
    await ctx.close();
  }

  // ============ CHECK 4: ADHERENCE RINGS (320/360/390, no auth) ============
  for (const width of [320, 360, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dev/fixtures/training`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const s = document.querySelector('section[aria-label="consistent"]');
      const h = s
        ? [...s.querySelectorAll("h3")].find(
            (n) => (n.textContent || "").trim() === "Plan adherence"
          )
        : null;
      h?.closest("figure")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(500);
    results.check4[width] = await page.evaluate(ADHERENCE, "consistent");
    if (width === 320) {
      // clip to the adherence card for a focused screenshot
      await page.screenshot({ path: `${SHOT}/fixed-adherence-320w.png` });
    }
    await ctx.close();
  }

  // ============ LABEL check: harness "Last 5 weeks" + live "This week" ============
  results.label.harness = results.check4[390]?.label ?? null;
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.clearCookies();
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/progress/training`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    results.label.live = await page.evaluate(() => {
      const h = [...document.querySelectorAll("h3")].find(
        (n) => (n.textContent || "").trim() === "Plan adherence"
      );
      const card = h ? h.closest("figure") : null;
      if (!card) return { found: false };
      const labelEl = [...card.querySelectorAll("span")].find((s) =>
        /^(This week|Last \d+ weeks?)$/.test((s.textContent || "").trim())
      );
      return {
        found: true,
        label: labelEl ? (labelEl.textContent || "").trim() : null,
      };
    });
    await ctx.close();
  }
} catch (e) {
  results.error = String(e.stack || e);
} finally {
  await browser.close();
  fs.writeFileSync(
    `${OURS}/reverify-p56b-results.json`,
    JSON.stringify(results, null, 2)
  );
  // Derived verdicts
  const c1 = (w) => {
    const r = results.check1[w];
    return r && r.found && r.textW > 180 && (r.below || r.beside);
  };
  const c2w = tickPass(results.check2.workouts?.ticks || []);
  const c2p = tickPass(results.check2.progress?.ticks || []);
  const c3 = results.check3?.found && results.check3?.intersects;
  const c4 = (w) => {
    const r = results.check4[w];
    return r && r.found && r.allInside && r.rightmostInside;
  };
  console.log("VERDICTS:");
  console.log("C1-390:", c1(390) ? "PASS" : "FAIL", results.check1[390]);
  console.log("C1-360:", c1(360) ? "PASS" : "FAIL", results.check1[360]);
  console.log("C2-workouts:", c2w ? "PASS" : "FAIL", results.check2.workouts);
  console.log("C2-progress:", c2p ? "PASS" : "FAIL", results.check2.progress);
  console.log("C3:", c3 ? "PASS" : "FAIL", results.check3);
  console.log("C4-320:", c4(320) ? "PASS" : "FAIL", results.check4[320]);
  console.log("C4-360:", c4(360) ? "PASS" : "FAIL", results.check4[360]);
  console.log("C4-390:", c4(390) ? "PASS" : "FAIL", results.check4[390]);
  console.log("LABEL:", results.label);
}
