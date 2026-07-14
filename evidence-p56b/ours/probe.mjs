import { chromium } from "@playwright/test";
const URL = "http://localhost:3600/dev/fixtures/training";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("theme", "dark"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3500);

const info = await page.evaluate(() => {
  const out = [];
  for (const node of document.querySelectorAll("span")) {
    const cs = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    if (cs.backgroundColor === "rgb(201, 42, 47)" && r.width > 80 && r.height > 80) {
      const parentSec = node.closest("section[aria-label]");
      out.push({
        cls: node.className,
        w: Math.round(r.width), h: Math.round(r.height),
        pos: cs.position, z: cs.zIndex, opacity: cs.opacity,
        parentTag: node.parentElement?.tagName,
        parentCls: (node.parentElement?.className || "").slice(0, 80),
        grandCls: (node.parentElement?.parentElement?.className || "").slice(0, 90),
        section: parentSec?.getAttribute("aria-label") || "none",
        html: node.outerHTML.slice(0, 200),
      });
    }
  }
  return out;
});
console.log(JSON.stringify(info, null, 2));
await ctx.close();
await browser.close();
