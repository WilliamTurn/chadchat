import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = "http://localhost:3600";
const SHOT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/mobile-audit";
const OURS = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/ours";
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
// Y-axis ticks = the recharts tick-value <text> aligned on the right gutter (max x).
const YTICKS = () => {
  const h = [...document.querySelectorAll("h3")].find(
    (n) => (n.textContent || "").trim() === "Training volume"
  );
  const card = h ? h.closest("figure") : null;
  if (!card) return { found: false };
  const svg = card.querySelector("svg.recharts-surface") || card.querySelector("svg");
  const texts = [...svg.querySelectorAll("text.recharts-cartesian-axis-tick-value")].map(
    (t) => ({ x: Math.round(parseFloat(t.getAttribute("x") || "0")), txt: (t.textContent || "").trim() })
  );
  const maxX = texts.reduce((m, t) => Math.max(m, t.x), 0);
  const yTicks = texts.filter((t) => t.x >= maxX - 3).map((t) => t.txt);
  return { found: true, yTicks };
};
const out = {};
const browser = await chromium.launch();

// ---- C2 screenshot + ticks on /workouts (touchless ok) ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.clearCookies();
  const page = await ctx.newPage();
  await login(page);
  for (const [key, url] of [["workouts", "/workouts"], ["progress", "/progress/training"]]) {
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const h = [...document.querySelectorAll("h3")].find((n) => (n.textContent || "").trim() === "Training volume");
      h?.closest("figure")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(700);
    out["c2_" + key] = await page.evaluate(YTICKS);
    if (key === "workouts") await page.screenshot({ path: `${SHOT}/fixed-volume-axis-390w.png` });
  }
  await ctx.close();
}

// ---- C3 drilldown with CORRECT record-card selector (touch) ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.clearCookies();
  const page = await ctx.newPage();
  await login(page);
  await page.goto(`${BASE}/workouts`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  // scroll grid top to viewport top
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((n) => /Personal records/i.test(n.textContent || ""));
    const grid = h ? h.parentElement?.querySelector(".grid") : null;
    if (grid) window.scrollTo(0, grid.getBoundingClientRect().top + window.scrollY);
  });
  await page.waitForTimeout(400);
  const firstRecord = page
    .locator('h2:has-text("Personal records")')
    .locator("xpath=..")
    .locator(".grid button[aria-expanded]")
    .first();
  await firstRecord.tap();
  await page.waitForTimeout(1000);
  out.c3 = await page.evaluate(() => {
    const openBtn = document.querySelector('button[aria-expanded="true"]');
    const panel = document.querySelector("section.overflow-hidden");
    const vh = window.innerHeight;
    const r = panel ? panel.getBoundingClientRect() : null;
    return {
      openCard: openBtn ? (openBtn.textContent || "").trim().slice(0, 24) : null,
      panelFound: !!panel,
      top: r ? Math.round(r.top) : null,
      bottom: r ? Math.round(r.bottom) : null,
      vh,
      intersects: r ? r.top < vh && r.bottom > 0 : null,
    };
  });
  await page.screenshot({ path: `${SHOT}/fixed-drilldown-390w.png` });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OURS}/reverify-c3-c2-results.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
