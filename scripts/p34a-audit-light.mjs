import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34a", "audit");
const BASE = "http://localhost:3600";
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: join(OUT,"state.json"), viewport:{width:390,height:844}, hasTouch:true, isMobile:true, deviceScaleFactor:2, colorScheme:"light" });
const page = await ctx.newPage();
// force light theme via next-themes localStorage
await page.addInitScript(() => { try{ localStorage.setItem('theme','light'); }catch(e){} });
await page.goto(`${BASE}/today`, { waitUntil:"domcontentloaded" });
await page.waitForTimeout(1800);
await page.screenshot({ path: join(OUT,"today-390-light.png") });
// crop the bar region: capture full then note. Also measure tap targets.
const tt = await page.$$eval('nav[aria-label="Primary"] > div > *', els => els.map(e => { const r=e.getBoundingClientRect(); return { label:(e.textContent||'').trim().slice(0,10), w:Math.round(r.width), h:Math.round(r.height) }; }));
console.log("tap targets:", JSON.stringify(tt));
await browser.close();
