// P34-Z pre-delivery audit: desktop grouped nav, mobile bottom nav, URL-state
// spot-checks, plan surfaces, auth forms. Read-only. Captures screenshots +
// console errors + touch-target/em-dash checks.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34z", "audit");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3600";
const PRO = join(OUT, "state-pro.json");
const SHOW = join(OUT, "state-showcase.json");
const report = {};

const EMDASH = /—/;
// known pre-existing console noise to ignore
const IGNORE = [
  /useActionState was called outside of a transition/i,
  /SessionMiniBar/i,
  /hydration/i, // NextJS hydration mismatch text sometimes generic; we still record raw
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
];

function attachConsole(page, bucket) {
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      bucket.push({ type: msg.type(), text: msg.text().slice(0, 300) });
    }
  });
  page.on("pageerror", (err) => bucket.push({ type: "pageerror", text: String(err).slice(0, 300) }));
}

async function textHasEmdash(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main") || document.body;
    return /—/.test(main.innerText || "");
  });
}

async function smallTargets(page, selector) {
  // interactive controls smaller than 44px in either dimension (visible only)
  return page.$$eval(selector, (els) =>
    els
      .map((e) => {
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        const label = (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 30);
        return { label, w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((x) => x && (x.w < 44 || x.h < 44))
  );
}

const browser = await chromium.launch();

// ============ 1. DESKTOP GROUPED NAV (FIX-20) @1440 both themes ============
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({
    storageState: PRO,
    viewport: { width: 1440, height: 900 },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  const bucket = [];
  attachConsole(page, bucket);
  await page.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch (e) {} }, theme);

  // standalone shell route (has standalone sidebar): /progress
  await page.goto(`${BASE}/progress`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT, `desktop-standalone-nav-${theme}-1440.png`), fullPage: false });

  // sidebar structure: groups + labels + active state
  const navInfo = await page.evaluate(() => {
    const aside = document.querySelector("aside, nav[aria-label]");
    const groups = Array.from(document.querySelectorAll('[data-sidebar="group"], .group')).length;
    const labels = Array.from(document.querySelectorAll('[data-sidebar="group-label"]')).map((e) => e.textContent.trim());
    const active = Array.from(document.querySelectorAll('a[aria-current="page"], [data-active="true"]')).map((e) => e.textContent.trim().slice(0, 30));
    const links = Array.from(document.querySelectorAll('aside a, nav a')).map((e) => e.textContent.trim().slice(0, 24)).filter(Boolean);
    return { hasAside: !!aside, groupCount: groups, labels, active, linkCount: links.length, links: links.slice(0, 40) };
  });
  const tt = await smallTargets(page, "aside a, aside button, nav a, nav button");
  report[`desktop_standalone_${theme}`] = { navInfo, smallTargets: tt, console: bucket.filter((b) => !IGNORE.some((r) => r.test(b.text))), consoleRaw: bucket.length };

  // chat sidebar route: /  (chat)
  const bucket2 = [];
  const page2 = await ctx.newPage();
  attachConsole(page2, bucket2);
  await page2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(2500);
  await page2.screenshot({ path: join(OUT, `desktop-chat-nav-${theme}-1440.png`), fullPage: false });
  report[`desktop_chat_${theme}`] = { console: bucket2.filter((b) => !IGNORE.some((r) => r.test(b.text))), consoleRaw: bucket2.length };

  await ctx.close();
}

// ============ 2. MOBILE BOTTOM NAV (FIX-21) @390 both themes ============
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({
    storageState: PRO,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  const bucket = [];
  attachConsole(page, bucket);
  await page.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch (e) {} }, theme);
  await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(OUT, `mobile-today-${theme}-390.png`) });

  const barInfo = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    if (!nav) return { present: false };
    const r = nav.getBoundingClientRect();
    const cs = getComputedStyle(nav);
    const tabs = Array.from(nav.querySelectorAll("a, button")).map((e) => {
      const rr = e.getBoundingClientRect();
      return {
        label: (e.querySelector("span:last-child")?.textContent || e.textContent || "").trim().slice(0, 12),
        w: Math.round(rr.width), h: Math.round(rr.height),
        active: e.getAttribute("aria-current") === "page",
      };
    });
    return { present: true, top: Math.round(r.top), h: Math.round(r.height), z: cs.zIndex, bg: cs.backgroundColor, blur: cs.backdropFilter, tabs };
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

  // Open Log drawer (tap the Log tab)
  let logDrawer = null;
  try {
    const logBtn = page.locator('nav[aria-label="Primary"] button, nav[aria-label="Primary"] a').filter({ hasText: /^Log$/ }).first();
    await logBtn.click({ timeout: 3000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(OUT, `mobile-log-drawer-${theme}-390.png`) });
    logDrawer = await page.evaluate(() => {
      const active = document.activeElement;
      const dialog = document.querySelector('[role="dialog"]');
      return {
        opened: !!dialog,
        activeEl: active ? active.tagName + (active.getAttribute("aria-label") ? `[${active.getAttribute("aria-label")}]` : "") : null,
        autofocusInput: !!(active && ["INPUT", "TEXTAREA"].includes(active.tagName)),
        items: dialog ? Array.from(dialog.querySelectorAll("a, button")).map((e) => e.textContent.trim().slice(0, 24)).filter(Boolean).slice(0, 12) : [],
      };
    });
    // close
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  } catch (e) { logDrawer = { error: String(e).slice(0, 120) }; }

  // Open More sheet
  let moreSheet = null;
  try {
    const moreBtn = page.locator('nav[aria-label="Primary"] button').filter({ hasText: /More/ }).first();
    await moreBtn.click({ timeout: 3000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(OUT, `mobile-more-sheet-${theme}-390.png`) });
    moreSheet = await page.evaluate(() => {
      const active = document.activeElement;
      const dialog = document.querySelector('[role="dialog"]');
      return {
        opened: !!dialog,
        autofocusInput: !!(active && ["INPUT", "TEXTAREA"].includes(active.tagName)),
        items: dialog ? Array.from(dialog.querySelectorAll("a, button")).map((e) => e.textContent.trim().slice(0, 24)).filter(Boolean).slice(0, 20) : [],
      };
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } catch (e) { moreSheet = { error: String(e).slice(0, 120) }; }

  const emdash = await textHasEmdash(page);
  report[`mobile_${theme}`] = { barInfo, overflow, logDrawer, moreSheet, emdashInMain: emdash, console: bucket.filter((b) => !IGNORE.some((r) => r.test(b.text))), consoleRaw: bucket.length };
  await ctx.close();
}

// ============ 3. URL-STATE surfaces (FIX-03) spot check ============
{
  const ctx = await browser.newContext({ storageState: PRO, viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  for (const route of ["/nutrition", "/progress", "/workouts"]) {
    const page = await ctx.newPage();
    const bucket = [];
    attachConsole(page, bucket);
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: join(OUT, `urlstate-${route.replace(/\//g, "")}-dark.png`) });
    const emdash = await textHasEmdash(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    report[`urlstate_${route.replace(/\//g, "")}`] = {
      finalUrl: page.url().replace(BASE, ""),
      overflow,
      emdashInMain: emdash,
      console: bucket.filter((b) => !IGNORE.some((r) => r.test(b.text))),
      consoleRaw: bucket.length,
    };
    await page.close();
  }
  await ctx.close();
}

// ============ 4. PLAN SURFACES (FIX-28) showcase account, read-only ============
{
  const ctx = await browser.newContext({ storageState: SHOW, viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  const bucket = [];
  attachConsole(page, bucket);
  // /workouts plan section
  await page.goto(`${BASE}/workouts`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, "plan-workouts-section-dark.png"), fullPage: true });
  const workoutsPlan = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasUpNext: /up next/i.test(body),
      hasPlan: /plan/i.test(body),
      emdash: /—/.test(document.querySelector("main")?.innerText || ""),
    };
  });
  // find a plan link to visit /plans/[id]
  const planHref = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href^="/plans/"]')).find((x) => /\/plans\/[^/]+$/.test(x.getAttribute("href")));
    return a ? a.getAttribute("href") : null;
  });
  report.plan_workouts = { workoutsPlan, planHref, console: bucket.filter((b) => !IGNORE.some((r) => r.test(b.text))), consoleRaw: bucket.length };

  if (planHref) {
    const bucket2 = [];
    const p2 = await ctx.newPage();
    attachConsole(p2, bucket2);
    await p2.goto(`${BASE}${planHref}`, { waitUntil: "domcontentloaded" });
    await p2.waitForTimeout(2500);
    await p2.screenshot({ path: join(OUT, "plan-detail-schedule-dark.png"), fullPage: true });
    const detail = await p2.evaluate(() => ({
      hasSchedule: /schedule|week|day|session/i.test(document.body.innerText),
      hasUpNext: /up next/i.test(document.body.innerText),
      emdash: /—/.test(document.querySelector("main")?.innerText || ""),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    report.plan_detail = { planHref, detail, console: bucket2.filter((b) => !IGNORE.some((r) => r.test(b.text))), consoleRaw: bucket2.length };
    await p2.close();
  }
  await ctx.close();
}

// ============ 5. AUTH FORMS (method=post fix) visual + method sanity ============
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  for (const route of ["/login", "/register", "/forgot-password"]) {
    const page = await ctx.newPage();
    const bucket = [];
    attachConsole(page, bucket);
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(OUT, `auth-${route.replace(/\//g, "")}-dark.png`) });
    const info = await page.evaluate(() => {
      const form = document.querySelector("form");
      const active = document.activeElement;
      return {
        formMethod: form ? form.getAttribute("method") : null,
        formAction: form ? form.getAttribute("action") : null,
        autofocused: active ? active.tagName + (active.getAttribute("type") ? `[${active.getAttribute("type")}]` : "") : null,
        emdash: /—/.test(document.querySelector("main")?.innerText || document.body.innerText || ""),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    report[`auth_${route.replace(/\//g, "")}`] = { info, console: bucket.filter((b) => !IGNORE.some((r) => r.test(b.text))), consoleRaw: bucket.length };
    await page.close();
  }
  await ctx.close();
}

writeFileSync(join(OUT, "audit-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
