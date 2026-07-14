import { chromium, BASE, newCtx, attachConsole } from './pw.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/ours';
const STATE = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/scripts/state.json';
const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));

async function shot(browser, path, { width, theme, touch, name, fullPage = true, addText = false }) {
  const ctx = await newCtx(browser, { width, height: touch ? 844 : 1000, theme, touch });
  await ctx.addCookies(state.cookies);
  const page = await ctx.newPage();
  const errs = [];
  attachConsole(page, errs);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  const out = { errs, headings: await page.locator('h1, h2').allInnerTexts() };
  if (addText) out.text = await page.locator('main, body').first().innerText();
  await ctx.close();
  return out;
}

async function run() {
  const browser = await chromium.launch();
  const res = {};
  try {
    // /plans desktop + mobile
    res.plans1440 = await shot(browser, '/plans', { width: 1440, theme: 'dark', touch: false, name: 'plans-1440-dark', addText: true });
    res.plans390 = await shot(browser, '/plans', { width: 390, theme: 'dark', touch: true, name: 'plans-390-dark' });
    // Reconciliation source pages (text only, plus a screenshot for the record)
    res.goals = await shot(browser, '/goals', { width: 1440, theme: 'dark', touch: false, name: 'recon-goals-1440-dark', addText: true });
    res.progress = await shot(browser, '/progress', { width: 1440, theme: 'dark', touch: false, name: 'recon-progress-1440-dark', addText: true });
    res.mealplan = await shot(browser, '/meal-plan', { width: 1440, theme: 'dark', touch: false, name: 'recon-mealplan-1440-dark', addText: true });
  } finally {
    await browser.close();
  }
  fs.writeFileSync(`${OUT}/../scripts/recon-data.json`, JSON.stringify(res, null, 2));
  // Print compact: errs + headings + presence of Add-a-plan
  for (const [k, v] of Object.entries(res)) {
    console.log(`\n=== ${k} === errs=${JSON.stringify(v.errs)}`);
    console.log('headings:', JSON.stringify(v.headings));
  }
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
