/**
 * P34-Z audit-fix verification. Four fixes:
 *  1. Anchor offset below 60px sticky header (/nutrition#log-meal, /progress#log-entry, /workouts#history)
 *  2. No Radix "Missing Description/aria-describedby" warning on Log drawer + More sheet (/today)
 *  3. aria-current="page" on /account link inside More sheet while on /account
 *  4. No email-input autofocus on cold /login
 * Plus spot check: bottom bar renders + Log drawer "Log a meal" navigates to /nutrition with log-meal visible.
 *
 * Read-only on prod data. Pro test account. Assumes dev server at :3600.
 *   node scripts/p34z-auditfix-check.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";

const BASE = "http://localhost:3600";
const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p34z";
const SHOTS = `${OUT}/audit`;
mkdirSync(SHOTS, { recursive: true });
const EMAIL = "claude-testing@example.com";
const PASSWORD = "12345678";
const HEADER_H = 60;
const navSel = 'nav[aria-label="Primary"]';
const RADIX_RE = /Missing `?Description`?|aria-describedby/i;

const results = [];
const rec = (id, pass, detail) => {
  results.push({ id, pass, detail });
  const tag = pass === true ? "PASS" : pass === false ? "FAIL" : "NOTE";
  console.log(`[${tag}] ${id} :: ${detail}`);
};
const shot = async (page, name) => {
  await page.screenshot({ path: `${SHOTS}/${name}`, fullPage: false });
  console.log(`  shot ${name}`);
};

(async () => {
  const browser = await chromium.launch();

  // ---------- login ----------
  const loginCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const lp = await loginCtx.newPage();
  await lp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await lp.waitForTimeout(800);
  const robustFill = async (sel, val) => {
    for (let i = 0; i < 5; i++) {
      await lp.fill(sel, val);
      await lp.waitForTimeout(150);
      if ((await lp.inputValue(sel)) === val) return true;
    }
    return false;
  };
  await robustFill('input[type="email"]', EMAIL);
  await robustFill('input[type="password"]', PASSWORD);
  await lp.getByRole("button", { name: "Sign in", exact: true }).click();
  await lp.waitForTimeout(3500);
  await lp.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
  await lp.waitForTimeout(800);
  const authed = new URL(lp.url()).pathname === "/today";
  if (!authed) {
    rec("login", false, `could not authenticate; landed ${lp.url()}`);
    await browser.close();
    finish();
    process.exit(1);
  }
  const storageState = await loginCtx.storageState();
  await loginCtx.close();

  const mkPhone = async () => {
    const ctx = await browser.newContext({
      storageState,
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    await ctx.addInitScript(() => { try { localStorage.setItem("theme", "dark"); } catch {} });
    return ctx;
  };

  // =========== FIX 1: anchor offset ===========
  const anchors = [
    { path: "/nutrition", id: "log-meal" },
    { path: "/progress", id: "log-entry" },
    { path: "/workouts", id: "history" },
  ];
  for (const a of anchors) {
    const ctx = await mkPhone();
    const page = await ctx.newPage();
    // cold navigate directly to the hash URL
    await page.goto(`${BASE}${a.path}#${a.id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // let scroll settle
    const info = await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return { found: false };
      const r = el.getBoundingClientRect();
      // find a heading inside the section, check it is visible in viewport
      const heading = el.querySelector("h1,h2,h3,h4,[role=heading]");
      let headingVisible = false, headingText = null, headingTop = null;
      if (heading) {
        const hr = heading.getBoundingClientRect();
        headingText = heading.textContent.trim().slice(0, 60);
        headingTop = Math.round(hr.top);
        headingVisible = hr.top >= 0 && hr.top < window.innerHeight && hr.bottom > 0;
      }
      return { found: true, top: Math.round(r.top), headingVisible, headingText, headingTop, vh: window.innerHeight };
    }, a.id);
    if (!info.found) {
      rec(`fix1/${a.path}#${a.id}`, false, `element #${a.id} not found`);
    } else {
      const pass = info.top >= HEADER_H && info.headingVisible;
      rec(`fix1/${a.path}#${a.id}`, pass,
        `section top=${info.top}px (want >=${HEADER_H}); heading "${info.headingText}" top=${info.headingTop} visible=${info.headingVisible}`);
    }
    await shot(page, `fix1-${a.id}.png`);
    await ctx.close();
  }

  // =========== FIX 2: no Radix description warning ===========
  {
    const ctx = await mkPhone();
    const page = await ctx.newPage();
    const warns = [];
    page.on("console", (m) => {
      const t = m.text();
      if (RADIX_RE.test(t)) warns.push({ type: m.type(), text: t });
    });
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForSelector(navSel, { state: "visible", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    // open Log drawer
    await page.getByRole("button", { name: "Log", exact: true }).click();
    await page.waitForTimeout(700);
    await shot(page, "fix2-log-drawer.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    // open More sheet
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.waitForTimeout(700);
    await shot(page, "fix2-more-sheet.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    rec("fix2/no-radix-warning", warns.length === 0,
      warns.length === 0 ? "0 Missing-Description/aria-describedby warnings after opening Log drawer + More sheet"
        : `${warns.length} warnings: ${warns.map((w) => w.text.slice(0, 120)).join(" | ")}`);
    await ctx.close();
  }

  // =========== FIX 3: aria-current on /account link in More sheet ===========
  {
    const ctx = await mkPhone();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
    await page.waitForSelector(navSel, { state: "visible", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.waitForTimeout(700);
    const acc = await page.evaluate(() => {
      const scope = document.querySelector('[data-slot="drawer-content"]') || document;
      const link = Array.from(scope.querySelectorAll("a")).find((x) => (x.getAttribute("href") || "") === "/account");
      if (!link) return { found: false };
      return { found: true, ariaCurrent: link.getAttribute("aria-current"), text: link.textContent.trim().slice(0, 40) };
    });
    if (!acc.found) rec("fix3/account-aria-current", false, "/account link not found in More sheet");
    else rec("fix3/account-aria-current", acc.ariaCurrent === "page", `/account link ("${acc.text}") aria-current=${acc.ariaCurrent} (want page)`);
    await shot(page, "fix3-more-sheet-account.png");
    await page.keyboard.press("Escape");
    await ctx.close();
  }

  // =========== FIX 4: no login autofocus (fresh, no cookies) ===========
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const focus = await page.evaluate(() => {
      const ae = document.activeElement;
      const email = document.querySelector('input[type="email"], input[name="email"]');
      return {
        activeTag: ae ? ae.tagName.toLowerCase() : "none",
        activeType: ae ? (ae.getAttribute("type") || "") : "",
        isEmail: !!(ae && email && ae === email),
        isBody: ae === document.body,
      };
    });
    rec("fix4/no-login-autofocus", !focus.isEmail,
      `activeElement=${focus.activeTag}${focus.activeType ? "[" + focus.activeType + "]" : ""}, isEmailInput=${focus.isEmail}`);
    await shot(page, "fix4-login-cold.png");
    await ctx.close();
  }

  // =========== SPOT: bottom bar renders + Log drawer navigates ===========
  {
    const ctx = await mkPhone();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForSelector(navSel, { state: "visible", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    const barVisible = await page.isVisible(navSel).catch(() => false);
    rec("spot/bottom-bar-renders", barVisible, `nav[aria-label=Primary] visible=${barVisible}`);
    await page.getByRole("button", { name: "Log", exact: true }).click();
    await page.waitForTimeout(600);
    const meal = page.locator('[data-slot="drawer-content"] a', { hasText: "Log a meal" }).first();
    await meal.click();
    await page.waitForTimeout(1600);
    const nav = await page.evaluate(() => {
      const el = document.getElementById("log-meal");
      const r = el ? el.getBoundingClientRect() : null;
      const heading = el ? el.querySelector("h1,h2,h3,h4,[role=heading]") : null;
      const hr = heading ? heading.getBoundingClientRect() : null;
      return {
        path: location.pathname, hash: location.hash,
        top: r ? Math.round(r.top) : null,
        headingVisible: hr ? (hr.top >= 0 && hr.top < window.innerHeight && hr.bottom > 0) : false,
      };
    });
    const spotPass = nav.path === "/nutrition" && nav.top !== null && nav.top >= HEADER_H && nav.headingVisible;
    rec("spot/log-a-meal-navigates", spotPass,
      `landed ${nav.path}${nav.hash}; log-meal top=${nav.top} (want >=${HEADER_H}) headingVisible=${nav.headingVisible}`);
    await shot(page, "spot-log-a-meal-nutrition.png");
    await ctx.close();
  }

  await browser.close();
  finish();

  function finish() {
    const pass = results.filter((r) => r.pass === true).length;
    const fail = results.filter((r) => r.pass === false).length;
    const note = results.filter((r) => r.pass === null).length;
    const stamp = new Date().toISOString();
    let md = `\n\n---\n\n# Audit-fix verification — ${stamp} (dated 2026-07-13)\n\n`;
    md += `Against ${BASE}, Pro test account ${EMAIL}, viewport 390x844, read-only. Screenshots in ./audit/.\n\n`;
    md += `**Totals: ${pass} PASS / ${fail} FAIL / ${note} NOTE**\n\n`;
    md += `| # | Assertion | Result | Detail |\n|---|---|---|---|\n`;
    results.forEach((r, i) => {
      const tag = r.pass === true ? "PASS" : r.pass === false ? "FAIL" : "NOTE";
      md += `| ${i + 1} | ${r.id} | ${tag} | ${String(r.detail).replace(/\|/g, "\\|")} |\n`;
    });
    const target = `${OUT}/audit-fix-verification.md`;
    if (existsSync(target)) appendFileSync(target, md);
    else writeFileSync(target, `# evidence-p34z audit-fix verification\n${md}`);
    console.log(`\n=== ${pass} PASS / ${fail} FAIL / ${note} NOTE ===`);
    console.log(`wrote ${target}`);
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
