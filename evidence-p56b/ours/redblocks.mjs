import { chromium } from "@playwright/test";

const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/ours";
const URL = "http://localhost:3600/dev/fixtures/training";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("theme", "dark"));
await page.reload({ waitUntil: "networkidle" });
// Long settle so any chart entrance animation fully completes.
await page.waitForTimeout(3000);

for (const id of ["sparse", "lapsed", "overshoot"]) {
  const sec = page.locator(`section[aria-label="${id}"]`);
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await sec.screenshot({ path: `${OUT}/section-${id}.png` });
  // Report the fill/rect elements that are large + red inside this section
  const info = await sec.evaluate((el) => {
    const out = [];
    for (const node of el.querySelectorAll("svg, canvas, [style*='background']")) {
      const r = node.getBoundingClientRect();
      if (r.width > 100 && r.height > 100) {
        const cs = getComputedStyle(node);
        out.push({ tag: node.tagName, w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor, fill: cs.fill });
      }
    }
    return out;
  });
  console.log(id, JSON.stringify(info));
}
await ctx.close();
await browser.close();
console.log("done");
