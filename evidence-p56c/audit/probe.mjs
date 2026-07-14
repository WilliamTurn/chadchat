import { makeBrowser, ctxFor, BASE, OUT } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const { browser, authCookies } = await makeBrowser();
const report = {};

async function probe(ctx, path, label) {
  const page = await ctx.newPage();
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);
    const hasAnchor = (id) => !!document.getElementById(id);
    // panel headline
    const headings = [...document.querySelectorAll("h1,h2,h3")].map((h) => h.textContent.trim());
    // upgrade prompt?
    const upgrade = document.body.innerText.includes("Chad Pro feature");
    // detail links present
    const detailLinks = [...document.querySelectorAll("a[href^='#'], a[href$='#history']")].map((a) => ({
      text: a.textContent.trim().slice(0, 40),
      href: a.getAttribute("href"),
    }));
    return {
      url: location.href,
      title: document.title,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      upgrade,
      hasHistoryAnchor: hasAnchor("history"),
      hasLogPastDayAnchor: hasAnchor("log-past-day"),
      headings: headings.slice(0, 12),
      detailLinks,
      bodyStart: document.body.innerText.replace(/\s+/g, " ").slice(0, 600),
    };
  });
  report[label] = { status: resp?.status(), ...info };
  await page.screenshot({ path: `${OUT}/probe-${label}.png`, fullPage: true });
  await page.close();
}

const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 900 }, "dark");
await probe(ctx, "/hydration", "hydration-1440-dark");
await probe(ctx, "/sleep", "sleep-1440-dark");
await probe(ctx, "/today", "today-1440-dark");
await ctx.close();

writeFileSync(`${OUT}/probe.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
