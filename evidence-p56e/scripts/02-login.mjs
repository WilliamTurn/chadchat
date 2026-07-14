import { chromium, BASE, CREDS, newCtx, attachConsole } from './pw.mjs';

const STATE = 'C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56e/scripts/state.json';

async function run() {
  const browser = await chromium.launch();
  try {
    const ctx = await newCtx(browser, { width: 1440, height: 900, theme: 'dark' });
    const page = await ctx.newPage();
    const errs = [];
    attachConsole(page, errs);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[name="email"]').fill(CREDS.email);
    await page.locator('input[name="password"]').fill(CREDS.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    // wait for navigation away from /login
    await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const url = page.url();
    await ctx.storageState({ path: STATE });
    console.log(JSON.stringify({ afterLoginUrl: url, errs }, null, 2));
  } finally {
    await browser.close();
  }
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
