/** Capture console errors/warnings on the harness page (the "N Issues" badge). */
import { chromium } from "@playwright/test";
const BASE = "http://localhost:3600";
const ROUTE = "/dev/fixtures/today-panels";
const browser = await chromium.launch();
const page = await browser.newContext({ colorScheme: "dark" }).then((c) => c.newPage());
const msgs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") {
    msgs.push(`[${m.type()}] ${m.text()}`);
  }
});
page.on("pageerror", (e) => msgs.push(`[pageerror] ${e.message}`));
await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log(`captured ${msgs.length} error/warning messages:`);
for (const m of msgs) {
  console.log("----\n" + m.slice(0, 500));
}
await browser.close();
