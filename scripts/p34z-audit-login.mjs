// P34-Z pre-delivery audit: log in Pro + showcase accounts, save storage states.
// Read-only against SHARED PROD DB. No submit/save/delete of member data.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34z", "audit");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3600";

const accounts = [
  { name: "pro", email: "claude-testing@example.com", password: "12345678", state: "state-pro.json" },
  { name: "showcase", email: "stellarluxedecor@gmail.com", password: "jojo0607$$C!", state: "state-showcase.json" },
];

const browser = await chromium.launch();
for (const acc of accounts) {
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
  const eOk = await robustFill('input[type="email"]', acc.email);
  const pOk = await robustFill('input[type="password"]', acc.password);
  await lp.getByRole("button", { name: "Sign in", exact: true }).click();
  await lp.waitForTimeout(4000);
  await lp.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
  await lp.waitForTimeout(1500);
  const url = lp.url();
  console.log(`${acc.name}: filled(e=${eOk},p=${pOk}) after-login=${url}`);
  if (url.includes("/login")) { console.log(`${acc.name} LOGIN FAILED`); }
  else { await ctx.storageState({ path: join(OUT, acc.state) }); console.log(`${acc.name} storage saved`); }
  await ctx.close();
}
await browser.close();
