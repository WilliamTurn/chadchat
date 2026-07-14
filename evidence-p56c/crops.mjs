/** Element-level crops for visual contrast verification. */
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3600";
const ROUTE = "/dev/fixtures/today-panels";
const OUT = join(process.cwd(), "evidence-p56c", "harness");

async function shotConsistent(theme) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    colorScheme: theme,
    reducedMotion: "reduce",
    deviceScaleFactor: 2,
  });
  await context.addInitScript((t) => {
    window.localStorage.setItem("theme", t);
  }, theme);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // consistent section = 3rd section (index 2)
  const handles = await page.evaluateHandle(() => {
    const secs = [...document.querySelectorAll("section")];
    return secs.find(
      (s) => s.querySelector("h2")?.textContent.trim() === "consistent"
    );
  });
  const el = handles.asElement();
  if (el) {
    await el.screenshot({ path: join(OUT, `crop-consistent-${theme}.png`) });
  }
  // also first-run (empty) + locked for state variety
  const firstRun = await page.evaluateHandle(() => {
    const secs = [...document.querySelectorAll("section")];
    return secs.find(
      (s) => s.querySelector("h2")?.textContent.trim() === "first-run"
    );
  });
  const el2 = firstRun.asElement();
  if (el2) {
    await el2.screenshot({ path: join(OUT, `crop-firstrun-${theme}.png`) });
  }
  await browser.close();
}

for (const theme of ["dark", "light"]) {
  await shotConsistent(theme);
}
console.log("crops done");
