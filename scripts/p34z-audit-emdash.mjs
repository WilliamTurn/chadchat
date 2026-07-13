// Extract the actual em-dash-bearing text nodes on audited pages + desktop sidebar links.
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34z", "audit");
const BASE = "http://localhost:3600";
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: join(OUT, "state-pro.json"), viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
for (const route of ["/today", "/progress"]) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  const hits = await page.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(document.querySelector("main") || document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      if (/—/.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 120));
    }
    return out;
  });
  console.log(`\n=== ${route} em-dash hits (${hits.length}) ===`);
  hits.forEach((h) => console.log("  •", h));
}
// desktop sidebar full link list on a standalone route
await page.goto(`${BASE}/progress`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const side = await page.evaluate(() => {
  const aside = document.querySelector("aside");
  if (!aside) return { none: true };
  const links = Array.from(aside.querySelectorAll("a")).map((a) => ({ t: a.textContent.trim().slice(0, 24), active: a.getAttribute("aria-current") === "page" }));
  const labels = Array.from(aside.querySelectorAll('[data-sidebar="group-label"], [class*="eyebrow"]')).map((e) => e.textContent.trim());
  return { linkCount: links.length, links, labels };
});
console.log("\n=== desktop /progress <aside> ===\n", JSON.stringify(side, null, 2));
await browser.close();
