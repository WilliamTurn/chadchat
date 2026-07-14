import { chromium } from "@playwright/test";
const BASE = "http://localhost:3600";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
await ctx.clearCookies();
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
console.log("login url", page.url());
await page.locator('input[type="email"]').fill("claude-testing@example.com");
await page.locator('input[autocomplete="current-password"]').fill("12345678");
await page.getByRole("button", { name: "Sign in" }).click();
await sleep(3500);
console.log("after login url", page.url());
await page.goto(`${BASE}/hydration`, { waitUntil: "domcontentloaded" });
await sleep(2000);
console.log("hydration url", page.url());
const info = await page.evaluate(() => {
  const p = document.querySelector('[data-panel-role="quick-log"]');
  if (!p) return { panel: false, bodyText: document.body.innerText.slice(0, 300) };
  return {
    panel: true,
    state: p.getAttribute("data-panel-state"),
    hasGauge: !!p.querySelector('[role="img"] svg'),
    paths: p.querySelector('[role="img"] svg') ? p.querySelector('[role="img"] svg').querySelectorAll("path").length : 0,
    dots: p.querySelectorAll("span.rounded-full.size-3").length,
    h12: [...p.querySelectorAll("div.h-12")].map((d) => d.children.length),
    metric: p.querySelector(".text-metric")?.textContent,
    headline: p.querySelector(".items-baseline")?.textContent,
    logWaterBtns: [...p.querySelectorAll("button")].filter((b) => /log water/i.test(b.textContent)).length,
    moreOptions: !!p.querySelector('[aria-label="More options"]'),
    detailLink: [...p.querySelectorAll("a")].map((a) => ({ t: a.textContent, h: a.getAttribute("href") })),
  };
});
console.log("HYDRATION", JSON.stringify(info, null, 2));
console.log("has #history", await page.locator("#history").count(), "has #log-past-day", await page.locator("#log-past-day").count());

await page.goto(`${BASE}/sleep`, { waitUntil: "domcontentloaded" });
await sleep(2000);
const s = await page.evaluate(() => {
  const p = document.querySelector('[data-panel-role="quick-log"]');
  if (!p) return { panel: false };
  const colContainer = [...p.querySelectorAll("div.items-end")].find((d) => d.querySelectorAll(":scope > *[aria-label]").length >= 7);
  return {
    panel: true,
    state: p.getAttribute("data-panel-state"),
    cols: colContainer ? colContainer.querySelectorAll(":scope > *[aria-label]").length : 0,
    dashed: p.querySelectorAll(".border-dashed").length,
    dots: p.querySelectorAll("span.rounded-full.size-3").length,
    headline: p.querySelector(".items-baseline")?.textContent || p.querySelector(".text-metric")?.textContent,
    stripLabels: [...p.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).filter((l) => /\w{3}, \w{3} \d{1,2}:/.test(l)),
    primaryLogLastNight: [...p.querySelectorAll("button")].some((b) => /log last night/i.test(b.textContent)),
    moreOptions: !!p.querySelector('[aria-label="More options"]'),
  };
});
console.log("SLEEP", JSON.stringify(s, null, 2));
const hist = await page.evaluate(() => {
  const h = document.getElementById("history"); if (!h) return { section: false };
  return { section: true, rows: [...h.querySelectorAll(".font-medium")].map((e) => e.textContent).slice(0, 10) };
});
console.log("SLEEP HISTORY", JSON.stringify(hist, null, 2));
await b.close();
