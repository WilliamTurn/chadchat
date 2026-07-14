import { chromium, BASE, newCtx, attachConsole } from './pw.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/ours';
const STATE = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/scripts/state.json';
const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));

async function run() {
  const browser = await chromium.launch();
  try {
    const ctx = await newCtx(browser, { width: 1440, height: 1000, theme: 'dark' });
    await ctx.addCookies(state.cookies);
    const page = await ctx.newPage();
    const errs = [];
    attachConsole(page, errs);
    await page.goto(`${BASE}/meal-plan`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    // Day tab is a button that contains "Day 3" text
    const dayTab = page.locator('button', { hasText: /Day 3/ }).first();
    await dayTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/recon-mealplan-day3-1440-dark.png`, fullPage: true });
    const text = await page.locator('main, body').first().innerText();
    fs.writeFileSync(`${OUT}/../scripts/mealplan-day3-text.txt`, text);
    console.log('errs=', JSON.stringify(errs));
    console.log('has Egg whites:', /Egg whites/i.test(text));
    console.log('has 670:', /670/i.test(text));
    await ctx.close();
  } finally {
    await browser.close();
  }
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
