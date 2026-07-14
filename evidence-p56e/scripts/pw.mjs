// Shared helper: resolves playwright from the pnpm store and exposes chromium.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pwPath = require.resolve(
  'playwright',
  { paths: ['C:/Users/jon17/Desktop/chadlatest/chadchat/node_modules/.pnpm/playwright@1.51.0/node_modules'] }
);
const pw = require(pwPath);
export const { chromium } = pw;

export const BASE = 'http://localhost:3600';
export const CREDS = { email: 'claude-testing@example.com', password: '12345678' };

export async function newCtx(browser, { width = 1440, height = 900, theme = 'dark', touch = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    hasTouch: touch,
    isMobile: touch,
    deviceScaleFactor: touch ? 2 : 1,
  });
  // App uses next-themes attribute="class" defaultTheme="dark"; force the
  // explicit choice via localStorage so it wins regardless of default.
  await ctx.addInitScript((t) => {
    try { window.localStorage.setItem('theme', t); } catch {}
  }, theme);
  return ctx;
}

export function attachConsole(page, sink) {
  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') sink.push(`[${t}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => sink.push(`[pageerror] ${err.message}`));
}

// Force the app's theme by setting the html data-theme / class if the app uses one.
export async function applyTheme(page, theme) {
  await page.evaluate((t) => {
    const r = document.documentElement;
    r.setAttribute('data-theme', t);
    r.classList.remove('dark', 'light');
    r.classList.add(t);
    r.style.colorScheme = t;
  }, theme);
}
