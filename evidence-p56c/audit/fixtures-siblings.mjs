import { makeBrowser, ctxFor, BASE, OUT } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const { browser, authCookies } = await makeBrowser();
const log = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };

/* ---------- FIXTURES (dark + light), no login required but auth is fine ---------- */
for (const theme of ["dark", "light"]) {
  const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 1000 }, theme);
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
  const resp = await page.goto(`${BASE}/dev/fixtures/today-panels`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const sections = [...document.querySelectorAll("section")].map((s) => {
      const h = s.querySelector("h2")?.textContent?.trim();
      const panels = [...s.querySelectorAll("[data-panel-role]")].map((p) => ({
        role: p.getAttribute("data-panel-role"),
        state: p.getAttribute("data-panel-state"),
        title: p.querySelector("[data-slot], h3, .text-eyebrow")?.textContent?.trim()?.slice(0, 30) || null,
      }));
      return { h, panels };
    }).filter((s) => s.h);
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      loadingSkeletons: document.querySelectorAll('[aria-busy="true"]').length,
      errorBodies: (document.body.innerText.match(/couldn't load/gi) || []).length,
      lockUpgrades: (document.body.innerText.match(/Upgrade to Pro/g) || []).length,
      sectionCount: [...document.querySelectorAll("section")].filter((s) => s.querySelector("h2")).length,
      sections,
    };
  });
  rec({ step: `fixtures-${theme}`, status: resp?.status(), overflow: info.overflow, loadingSkeletons: info.loadingSkeletons, errorBodies: info.errorBodies, lockUpgrades: info.lockUpgrades, sectionCount: info.sectionCount, consoleErrsSample: errs.slice(0, 4) });
  writeFileSync(`${OUT}/fixtures-${theme}-sections.json`, JSON.stringify(info.sections, null, 2));
  await page.screenshot({ path: `${OUT}/fixtures-${theme}.png`, fullPage: true });
  // Light-theme populated contrast spot check on the panels
  if (theme === "light") {
    const contrast = await page.evaluate(() => {
      const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(",").slice(0, 3).map((n) => parseFloat(n)) : null; };
      const ratio = (fg, bg) => { const a = lum(fg) + 0.05, b = lum(bg) + 0.05; return +((Math.max(a, b) / Math.min(a, b)).toFixed(2)); };
      const bgOf = (el) => { let e = el; while (e) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); const am = cs.backgroundColor.match(/rgba?\(([^)]+)\)/); const a = am ? (am[1].split(",")[3] ?? "1") : "1"; if (c && parseFloat(a) > 0.5) return c; e = e.parentElement; } return [255, 255, 255]; };
      const out = [];
      // sample muted text + headline metric + coverage lines inside panels
      const panels = [...document.querySelectorAll("[data-panel-role='quick-log'][data-panel-state='populated']")].slice(0, 6);
      panels.forEach((p, i) => {
        const muted = p.querySelector(".text-muted-foreground");
        const metric = p.querySelector(".text-metric, .text-metric-lg");
        for (const [lab, el] of [[`p${i}-muted`, muted], [`p${i}-metric`, metric]]) {
          if (!el) continue;
          const fg = parse(getComputedStyle(el).color);
          const bg = bgOf(el.parentElement || el);
          if (fg) out.push({ lab, ratio: ratio(fg, bg), text: el.textContent.trim().slice(0, 24) });
        }
      });
      return out;
    });
    rec({ step: "fixtures-light-contrast", contrast });
  }
  await page.close();
  await ctx.close();
}

/* ---------- SIBLINGS (dark) ---------- */
const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 900 }, "dark");
const page = await ctx.newPage();
const sibErrs = [];
page.on("console", (m) => { if (m.type() === "error") sibErrs.push(m.text().slice(0, 140)); });

// /nutrition: TargetEditor opens from the card footer
await page.goto(`${BASE}/nutrition`, { waitUntil: "load" }); await page.waitForTimeout(2500);
const nutOverflow = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, hasReactErr: /Minified React error/.test(document.body.innerText) }));
let targetOpened = false;
try {
  const tbtn = page.getByRole("button", { name: /targets/i }).first();
  await tbtn.click({ timeout: 6000 }); await page.waitForTimeout(700);
  targetOpened = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? /Daily targets/i.test(d.textContent) : false; });
  await page.screenshot({ path: `${OUT}/nutrition-targeteditor.png` });
  await page.keyboard.press("Escape");
} catch (e) { rec({ step: "nutrition-target-err", err: String(e).slice(0, 120) }); }
rec({ step: "sibling-nutrition", ...nutOverflow, targetEditorOpens: targetOpened });
await page.screenshot({ path: `${OUT}/nutrition-page.png`, fullPage: true });

// /progress
await page.goto(`${BASE}/progress`, { waitUntil: "load" }); await page.waitForTimeout(2500);
rec({ step: "sibling-progress", ...(await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, hasReactErr: /Minified React error/.test(document.body.innerText), headings: [...document.querySelectorAll("h1,h2")].map((h) => h.textContent.trim()).slice(0, 6) }))) });
await page.screenshot({ path: `${OUT}/progress-page.png`, fullPage: true });

// /today
await page.goto(`${BASE}/today`, { waitUntil: "load" }); await page.waitForTimeout(2500);
rec({ step: "sibling-today", ...(await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, hasReactErr: /Minified React error/.test(document.body.innerText), hasWater: /WATER/.test(document.body.innerText), hasSleep: /SLEEP/.test(document.body.innerText) }))) });
await page.screenshot({ path: `${OUT}/today-page.png`, fullPage: true });

rec({ step: "sibling-console-errors", sample: sibErrs.slice(0, 6) });
writeFileSync(`${OUT}/fixtures-siblings.json`, JSON.stringify(log, null, 2));
console.log("=== FIXTURES+SIBLINGS DONE ===");
await ctx.close();
await browser.close();
