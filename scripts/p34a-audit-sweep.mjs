// P34-A pre-delivery audit: sibling sweep at 390px touch, bottom-bar coverage,
// route-active semantics, overlay activeElement checks. Read-only.
import { chromium, devices } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34a", "audit");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3600";
const findings = [];
const log = (m) => { console.log(m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: join(OUT, "state.json"),
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const shot = async (n) => { await page.screenshot({ path: join(OUT, n) }); };

const navSel = 'nav[aria-label="Primary"]';

async function barBox() {
  return page.$eval(navSel, (nav) => {
    const r = nav.getBoundingClientRect();
    const cs = getComputedStyle(nav);
    return { top: r.top, bottom: r.bottom, height: r.height, transform: cs.transform, zIndex: cs.zIndex, display: cs.display };
  }).catch(() => null);
}

// Pages to sweep. Some may 404/redirect; we record what we see.
const routes = ["/today","/nutrition","/hydration","/sleep","/workouts","/progress","/goals","/account","/files","/quit-date","/help","/meal-plan","/kitchen","/reports","/future-you"];

const report = {};

for (const route of routes) {
  const entry = { route };
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch(()=>{});
  await page.waitForTimeout(1200);
  entry.finalUrl = page.url().replace(BASE, "");
  // horizontal overflow
  entry.overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  entry.scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  // bar present?
  const bb = await barBox();
  entry.bar = bb ? { top: Math.round(bb.top), bottom: Math.round(bb.bottom), h: Math.round(bb.height), z: bb.zIndex, display: bb.display } : null;
  // which tab active
  entry.activeTabs = await page.$$eval(`${navSel} a[aria-current="page"]`, els => els.map(e => e.querySelector("span:last-child")?.textContent?.trim())).catch(()=>[]);
  // does the More button carry active styling? (font-semibold + text-foreground)
  entry.moreActive = await page.evaluate((sel) => {
    const nav = document.querySelector(sel); if (!nav) return null;
    const btns = Array.from(nav.querySelectorAll("button"));
    const more = btns.find(b => b.textContent.trim().includes("More"));
    if (!more) return null;
    return more.className.includes("text-foreground") && more.className.includes("font-semibold");
  }, navSel);
  // scroll to bottom, check if bar covers the last bit of content
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  // Find the lowest visible interactive element (button/a/input) NOT in the nav bar
  entry.coverage = await page.evaluate((sel) => {
    const nav = document.querySelector(sel);
    const navTop = nav ? nav.getBoundingClientRect().top : 9999;
    const vh = window.innerHeight;
    let worst = null;
    const els = Array.from(document.querySelectorAll("button, a, input, [role=button], summary"));
    for (const el of els) {
      if (nav && nav.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // element visible in viewport and its center sits under the bar
      const centerY = r.top + r.height / 2;
      if (centerY > navTop && r.top < vh && r.bottom > navTop + 4) {
        const label = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40);
        if (!worst || r.bottom > worst.bottom) worst = { label, top: Math.round(r.top), bottom: Math.round(r.bottom), navTop: Math.round(navTop) };
      }
    }
    return worst;
  }, navSel);
  report[route] = entry;
  log(`${route} -> url=${entry.finalUrl} overflow=${entry.overflow} bar=${entry.bar? 'y@'+entry.bar.top : 'NONE'} active=${JSON.stringify(entry.activeTabs)} moreActive=${entry.moreActive} covered=${entry.coverage? entry.coverage.label : 'none'}`);
  await shot(`sweep-${route.replace(/\//g,'_')||'root'}.png`);
}

writeFileSync(join(OUT, "sweep.json"), JSON.stringify(report, null, 2));
await browser.close();
log("DONE sweep");
