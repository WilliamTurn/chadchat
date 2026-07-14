import { chromium } from "@playwright/test";
import fs from "node:fs";
const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p56b/ours";
const BASE = "http://localhost:3600";
const results = [];
const rec = (n, p, d) => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"} :: ${n} :: ${d}`); };

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "claude-testing@example.com");
  await page.fill('input[type="password"]', "12345678");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.clearCookies();
const page = await ctx.newPage();
try {
  await login(page);

  // ---- deep-link ?range restore ----
  await page.goto(`${BASE}/progress/training?range=1w`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  rec("deep-link ?range=1w loads without redirect", page.url().includes("range=1w"), `url=${page.url()}`);

  // ---- range control presence + all aria-expanded button texts ----
  const probe = await page.evaluate(() => {
    const grp = document.querySelector('[aria-label="Time range"]');
    const grpBtns = grp ? [...grp.querySelectorAll("button")].map(b => b.textContent.trim()) : null;
    const rangeRow = [...document.querySelectorAll("p")].find(p => /sessions? in the|No sessions/.test(p.textContent))?.textContent || null;
    const expanded = [...document.querySelectorAll("button[aria-expanded]")].map(b => ({
      t: (b.textContent || "").trim().slice(0, 30),
      hasName: !!b.querySelector(".truncate.font-medium"),
    }));
    return { hasGroup: !!grp, grpBtns, rangeRow, expandedCount: expanded.length, sampleExpanded: expanded.slice(0, 8) };
  });
  rec("range control renders on live page", probe.hasGroup, `group=${probe.hasGroup} buttons=${JSON.stringify(probe.grpBtns)} rangeRow="${probe.rangeRow}"`);
  console.log("INFO expanded buttons:", JSON.stringify(probe.sampleExpanded));

  // ---- drill-down, scoped to Strength and records ----
  const recordBtn = page.locator('button[aria-expanded]:has(.truncate.font-medium)').filter({ hasText: /Overhead Press|Barbell|Press|Row|Pushdown|Squat|Deadlift|Curl/ }).first();
  const rbCount = await recordBtn.count();
  if (rbCount > 0) {
    const name = (await recordBtn.locator(".truncate.font-medium").innerText()).trim();
    await recordBtn.scrollIntoViewIfNeeded();
    await recordBtn.click();
    await page.waitForTimeout(900);
    const url = page.url();
    const hasPr = /[?&]pr=/.test(url);
    const epley = await page.getByText(/Epley formula/i).count();
    const est1rmChart = await page.getByText(/estimated 1RM/i).count();
    rec("drill-down: clicking a lift sets ?pr= + opens est.1RM chart", hasPr && est1rmChart > 0, `lift="${name}" url=${url} est1rm=${est1rmChart}`);
    rec("drill-down: Epley formula caption present", epley > 0, `epley=${epley}`);
    const vw = page.locator('a[href^="/workouts/history/"]');
    const vwCount = await vw.count();
    let href = null;
    if (vwCount > 0) { href = await vw.first().getAttribute("href"); }
    rec("drill-down: 'View workout' link to /workouts/history/<id>", vwCount > 0 && /^\/workouts\/history\/.+/.test(href || ""), `count=${vwCount} href=${href}`);
    // Back closes
    const beforeBack = page.url();
    await page.goBack({ waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(700);
    rec("drill-down: browser Back closes it (?pr removed)", !/[?&]pr=/.test(page.url()), `beforeBack=${beforeBack} afterBack=${page.url()}`);
  } else {
    rec("drill-down: a scoped record card was found", false, "none matched");
  }

  // ---- timeline entry link ----
  await page.goto(`${BASE}/progress/training`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const tl = await page.evaluate(() => {
    const sec = [...document.querySelectorAll("section")].find(s => /Records and milestones/i.test(s.textContent));
    if (!sec) return { found: false };
    const links = [...sec.querySelectorAll('a[href^="/workouts/history/"]')].map(a => a.getAttribute("href"));
    const heroLink = sec.querySelector('a[href^="/workouts/history/"]')?.getAttribute("href") || null;
    return { found: true, links, count: links.length, heroLink };
  });
  if (tl.found && tl.count > 0) {
    const resp = await page.request.get(`${BASE}${tl.links[0]}`);
    rec("timeline: entry links to a real workout page (200)", resp.status() === 200, `href=${tl.links[0]} status=${resp.status()} totalLinks=${tl.count}`);
  } else {
    rec("timeline: has at least one workout-linked entry", false, `tl=${JSON.stringify(tl)}`);
  }

  // ---- is the console warning global? check /today ----
  const todayErrors = [];
  const p2 = await ctx.newPage();
  p2.on("console", m => { if (m.type() === "error") todayErrors.push(m.text().slice(0, 80)); });
  p2.on("pageerror", e => todayErrors.push("pageerror:" + e.message.slice(0, 80)));
  await p2.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(2000);
  const useActionStateWarn = todayErrors.some(e => /useActionState/.test(e));
  rec("console warning 'useActionState' is GLOBAL (also on /today, not FIX-33-specific)", useActionStateWarn, `todayErrors=${JSON.stringify(todayErrors.slice(0,4))}`);
  await p2.close();

  // ---- /workouts PR drill-down scoped ----
  await page.goto(`${BASE}/workouts`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const wRec = page.locator('button[aria-expanded]:has(.truncate.font-medium)').first();
  if (await wRec.count() > 0) {
    await wRec.scrollIntoViewIfNeeded();
    await wRec.click();
    await page.waitForTimeout(900);
    const epley = await page.getByText(/Epley formula/i).count();
    const est = await page.getByText(/estimated 1RM/i).count();
    rec("/workouts PR drill-down: est.1RM chart + Epley caption", epley > 0 && est > 0, `epley=${epley} est=${est}`);
  } else {
    rec("/workouts PR drill-down: record card found", false, "none");
  }
} catch (e) {
  rec("SCRIPT ERROR", false, String(e.stack || e));
} finally {
  await browser.close();
  fs.writeFileSync(`${OUT}/live-fix-results.json`, JSON.stringify(results, null, 2));
  const f = results.filter(r => !r.p);
  console.log(`\n==== LIVE-FIX DONE: ${results.length - f.length}/${results.length} passed ====`);
}
