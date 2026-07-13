// Reach /plans/[id] for the showcase account, capture Weekly schedule + Up next.
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34z", "audit");
const BASE = "http://localhost:3600";
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: join(OUT, "state-showcase.json"), viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errs.push("PAGEERR " + String(e).slice(0, 200)));

await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const planHref = await page.evaluate(() => {
  const a = Array.from(document.querySelectorAll('a[href^="/plans/"]')).find((x) => /\/plans\/[0-9a-f-]{8,}/.test(x.getAttribute("href") || ""));
  return a ? a.getAttribute("href") : null;
});
console.log("planHref from /today:", planHref);
if (planHref) {
  await page.goto(`${BASE}${planHref}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2800);
  await page.screenshot({ path: join(OUT, "plan-detail-schedule-dark.png"), fullPage: true });
  const info = await page.evaluate(() => {
    const sched = document.querySelector('[aria-labelledby="plan-schedule-heading"]');
    const bodyText = document.body.innerText;
    const upNextBadges = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Up next$/i.test(e.textContent.trim())).length;
    return {
      hasWeeklySchedule: !!sched,
      scheduleHeading: sched ? sched.querySelector("h2")?.textContent.trim() : null,
      sessionCount: sched ? sched.querySelectorAll("ol > li").length : 0,
      upNextBadgeCount: upNextBadges,
      adherenceLine: /sessions done this week/i.test(bodyText),
      emdash: /—/.test(document.querySelector("main")?.innerText || bodyText),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  console.log("plan detail info:", JSON.stringify(info, null, 2));
}
// light theme too
await page.addInitScript(() => { try { localStorage.setItem("theme", "light"); } catch (e) {} });
if (planHref) {
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { try { localStorage.setItem("theme", "light"); } catch (e) {} });
  await p2.goto(`${BASE}${planHref}`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(2500);
  await p2.screenshot({ path: join(OUT, "plan-detail-schedule-light.png"), fullPage: true });
  await p2.close();
}
console.log("console errors:", JSON.stringify(errs));
await browser.close();
