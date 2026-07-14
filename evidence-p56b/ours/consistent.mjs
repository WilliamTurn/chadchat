import { chromium } from "@playwright/test";
const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/ours";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
await p.goto("http://localhost:3600/dev/fixtures/training", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.setItem("theme", "dark"));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(3000);
const sec = p.locator('section[aria-label="consistent"]');
await sec.scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
await sec.screenshot({ path: `${OUT}/section-consistent.png` });
// Measure the training-consistency frame height vs its heatmap content
const m = await sec.evaluate((el) => {
  const frame = [...el.querySelectorAll("*")].find(n => n.textContent?.includes("Training consistency"));
  const heat = el.querySelector(".grid.flex-1.grid-rows-7")?.closest(".flex.min-w-0");
  return {
    heatH: heat ? Math.round(heat.getBoundingClientRect().height) : null,
    heatW: heat ? Math.round(heat.getBoundingClientRect().width) : null,
  };
});
console.log("consistent heatmap box:", JSON.stringify(m));
await c.close(); await b.close();
