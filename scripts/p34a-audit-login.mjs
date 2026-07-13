// P34-A pre-delivery audit: login once, save storage state for reuse.
// Read-only against SHARED PROD DB. No submit/save/delete.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34a", "audit");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3600";
const EMAIL = "claude-testing@example.com";
const PASSWORD = "12345678";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const lp = await ctx.newPage();
await lp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await lp.waitForTimeout(1400);
const robustFill = async (sel, val) => {
  for (let i = 0; i < 6; i++) {
    await lp.fill(sel, val);
    await lp.waitForTimeout(200);
    if ((await lp.inputValue(sel)) === val) return true;
  }
  return false;
};
const eOk = await robustFill('input[type="email"]', EMAIL);
const pOk = await robustFill('input[type="password"]', PASSWORD);
console.log(`filled email=${eOk} password=${pOk}`);
await lp.getByRole("button", { name: "Sign in", exact: true }).click();
await lp.waitForTimeout(3500);
await lp.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
await lp.waitForTimeout(1500);
const url = lp.url();
console.log("after login, /today url =", url);
if (url.includes("/login")) {
  console.log("LOGIN FAILED");
  process.exit(1);
}
await ctx.storageState({ path: join(OUT, "state.json") });
console.log("storage saved");
await browser.close();
