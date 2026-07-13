import { chromium } from "@playwright/test";
const BASE = "http://localhost:3600";
const STATE = "scripts/.p34z-throwaway-state.json";
const evi = "evidence-p34z/fixverify";

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE + "/hydration", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${evi}/t3-03-hydration.png`, fullPage: true });
// Dump the interactive controls so we can see what's available.
const controls = await page.evaluate(() =>
  Array.from(document.querySelectorAll("button, a[href]"))
    .map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim())
    .filter(Boolean)
    .slice(0, 60)
);
await ctx.close();
await browser.close();
console.log(JSON.stringify({ controls, consoleErrors: errors }, null, 2));
