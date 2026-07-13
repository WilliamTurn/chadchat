import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3600";
const STATE = "scripts/.p34z-state.json";
const evi = "evidence-p34z/fixverify";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// --- login ---
await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.waitForSelector('input[type="email"]', { timeout: 10000 });
const form = page.locator("form", { has: page.locator('input[type="email"]') }).first();
await form.locator('input[type="email"]').fill("claude-testing@example.com");
await form.locator('input[type="password"]').fill("12345678");
await form.locator('input[type="password"]').press("Enter");
let authed = false;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1000);
  const cookies = await ctx.cookies();
  if (cookies.find((c) => /session-token/i.test(c.name))) { authed = true; break; }
  if (!page.url().includes("/login")) { authed = true; break; }
}
await ctx.storageState({ path: STATE });

// --- materialize schedule ---
await page.goto(BASE + "/workouts", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${evi}/t1-01-workouts.png`, fullPage: true });

// DB check after materialization
const matOut = execSync(`npx tsx scripts/p34z-fixverify-dbcheck.ts --plan d9c8299d-134e-4728-a680-ecadb119718b`, { encoding: "utf8" });
const matLine = matOut.split("\n").find((l) => l.startsWith("RESULT="));
const matState = matLine ? JSON.parse(matLine.slice(7)) : null;

// --- start Day 1 ---
const startBtn = page.getByRole("button", { name: /Start Day 1: Upper/i }).first();
await startBtn.waitFor({ state: "visible", timeout: 10000 });
await startBtn.click();
await page.waitForURL(/\/workouts\/session/, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${evi}/t1-02-session.png`, fullPage: true });

// --- finish ---
const finishBtn = page.getByRole("button", { name: /^Finish$/ }).first();
await finishBtn.waitFor({ state: "visible", timeout: 10000 });
await finishBtn.click();
await page.waitForTimeout(800);
const saveBtn = page.getByRole("button", { name: /Finish and save/i }).first();
await saveBtn.waitFor({ state: "visible", timeout: 10000 });
await saveBtn.click();

// land on history detail
await page.waitForURL(/\/workouts\/history\/[0-9a-f-]+/, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
const finalUrl = page.url();
const m = finalUrl.match(/\/workouts\/history\/([0-9a-f-]+)/);
const workoutId = m ? m[1] : null;
await page.screenshot({ path: `${evi}/t1-03-saved.png`, fullPage: true });

await ctx.close();
await browser.close();

console.log(JSON.stringify({ authed, materializeState: matState, finalUrl, workoutId, consoleErrors: errors }, null, 2));
