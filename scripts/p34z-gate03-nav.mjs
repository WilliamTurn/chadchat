/**
 * P34-Z GATE-03 items 2 (grouped desktop nav), 3 (mobile bottom nav),
 * 4 (keyboard-safe), 7 (console errors). FRESH run, read-only on prod data.
 * Pro test account claude-testing@example.com. Assumes dev server at :3600.
 *   node scripts/p34z-gate03-nav.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3600";
const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p34z";
const SHOTS = `${OUT}/gate03`;
mkdirSync(SHOTS, { recursive: true });
const EMAIL = "claude-testing@example.com";
const PASSWORD = "12345678";
const navSel = 'nav[aria-label="Primary"]';

const results = [];
const consoleErrors = [];
const rec = (id, pass, detail) => {
  results.push({ id, pass, detail });
  const tag = pass === true ? "PASS" : pass === false ? "FAIL" : "NOTE";
  console.log(`[${tag}] ${id} :: ${detail}`);
};
const attachConsole = (page, where) => {
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push({ where, text: m.text() });
  });
  page.on("pageerror", (e) => consoleErrors.push({ where, text: `pageerror: ${e.message}` }));
};
const shot = async (page, name) => {
  await page.screenshot({ path: `${SHOTS}/${name}`, fullPage: false });
  console.log(`  shot ${name}`);
};

async function tabInfo(page) {
  return page.$eval(navSel, (nav) => {
    const row = nav.querySelector("div");
    return Array.from(row.children).map((el) => {
      const r = el.getBoundingClientRect();
      const label = el.querySelector("span:last-child")?.textContent?.trim() || el.textContent.trim();
      return { label, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, ariaCurrent: el.getAttribute("aria-current") };
    });
  });
}

(async () => {
  const browser = await chromium.launch();

  // ---- login (fresh context) ----
  const loginCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const lp = await loginCtx.newPage();
  attachConsole(lp, "login");
  await lp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await lp.waitForTimeout(1000);
  const robustFill = async (sel, val) => {
    for (let i = 0; i < 5; i++) {
      await lp.fill(sel, val);
      await lp.waitForTimeout(200);
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
  rec("login", authed, `/today resolved to ${new URL(lp.url()).pathname}`);
  if (!authed) { await browser.close(); process.exit(1); }
  const storageState = await loginCtx.storageState();
  await loginCtx.close();

  const mkPhone = async (w, h, theme) => {
    const ctx = await browser.newContext({ storageState, viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
    return ctx;
  };
  const mkDesk = async (w, h, theme) => {
    const ctx = await browser.newContext({ storageState, viewport: { width: w, height: h } });
    await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
    return ctx;
  };

  // ================= ITEM 2: grouped DESKTOP sidebar at 1440 =================
  // Drive /workouts/history so we can also prove subroute-aware active state.
  const sidebarSel = '[data-slot="sidebar"], [data-sidebar="sidebar"]';
  for (const theme of ["dark", "light"]) {
    const ctx = await mkDesk(1440, 900, theme);
    const page = await ctx.newPage();
    attachConsole(page, `desktop-${theme}`);
    await page.goto(`${BASE}/workouts/history`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    // bottom bar must be absent at desktop
    const barVisible = await page.isVisible(navSel).catch(() => false);
    rec(`desktop-1440-${theme}/no-bottom-bar`, !barVisible, `bottom bar visible=${barVisible} (want false)`);

    const info = await page.evaluate((sel) => {
      const scope = document.querySelector(sel);
      if (!scope) return { error: "sidebar not found" };
      const captionEls = Array.from(scope.querySelectorAll('[data-sidebar="group-label"], [data-slot="sidebar-group-label"]'));
      const captions = captionEls.map((e) => e.textContent.trim()).filter(Boolean);
      const links = Array.from(scope.querySelectorAll("a"));
      const linkTexts = links.map((a) => a.textContent.trim());
      // quit-date utility entry: link with text "Quit Test" + a Skull svg
      const quit = links.find((a) => /Quit Test/i.test(a.textContent));
      let quitSkull = false;
      if (quit) {
        const svg = quit.querySelector("svg");
        quitSkull = !!svg && /skull/i.test(svg.getAttribute("class") || "");
      }
      // utility block hairline: the SidebarGroup wrapping Quit Test has border-top
      let borderTop = 0;
      if (quit) {
        let node = quit;
        for (let i = 0; i < 6 && node && node !== scope; i++) {
          const bt = parseFloat(getComputedStyle(node).borderTopWidth) || 0;
          if (bt >= 0.5) { borderTop = bt; break; }
          node = node.parentElement;
        }
      }
      // active state: the Workouts link's menu-button carries data-active=true
      const workoutsLink = links.find((a) => a.textContent.trim() === "Workouts");
      const activeAttr = workoutsLink ? workoutsLink.getAttribute("data-active") : null;
      // no OTHER top-level nav link should be active
      const activeLinks = links.filter((a) => a.getAttribute("data-active") === "true").map((a) => a.textContent.trim());
      // primary group links present
      const hasDashboard = linkTexts.some((t) => /Dashboard/i.test(t));
      return { captions, quitPresent: !!quit, quitSkull, borderTop, activeAttr, activeLinks, hasDashboard, linkTexts };
    }, sidebarSel);

    if (info.error) { rec(`desktop-1440-${theme}/sidebar`, false, info.error); await ctx.close(); continue; }
    const hasTPR = ["Track", "Plan", "Review"].every((c) => info.captions.includes(c));
    const noBad = !info.captions.includes("More") && !info.captions.includes("Utility") && !info.captions.includes("Primary");
    rec(`desktop-1440-${theme}/groups`, hasTPR && noBad, `captions=${JSON.stringify(info.captions)} (want Track/Plan/Review; NO More/Utility/Primary)`);
    rec(`desktop-1440-${theme}/primary-group`, info.hasDashboard, `Dashboard link present=${info.hasDashboard}`);
    rec(`desktop-1440-${theme}/utility-hairline`, info.borderTop >= 0.5, `utility block border-top=${info.borderTop}px`);
    rec(`desktop-1440-${theme}/quit-date-skull`, info.quitPresent && info.quitSkull, `Quit Test entry present=${info.quitPresent}, Skull icon=${info.quitSkull}`);
    rec(`desktop-1440-${theme}/active-subroute`, info.activeAttr === "true" && JSON.stringify(info.activeLinks) === JSON.stringify(["Workouts"]),
      `Workouts data-active=${info.activeAttr}; all active links=${JSON.stringify(info.activeLinks)} (want exactly [Workouts] on /workouts/history)`);
    await shot(page, `item2-sidebar-1440-${theme}.png`);
    await ctx.close();
  }

  // ================= ITEM 3: mobile bottom nav =================
  for (const [w, h] of [[320, 568], [360, 800], [390, 844]]) {
    for (const theme of ["dark", "light"]) {
      const ctx = await mkPhone(w, h, theme);
      const page = await ctx.newPage();
      attachConsole(page, `mobile-${w}-${theme}`);
      await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
      await page.waitForSelector(navSel, { state: "visible", timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      const key = `mobile-${w}-${theme}`;
      const visible = await page.isVisible(navSel).catch(() => false);
      rec(`${key}/bar-visible`, visible, `visible=${visible}`);
      if (visible) {
        const tabs = await tabInfo(page);
        const labels = tabs.map((t) => t.label);
        rec(`${key}/labels`, JSON.stringify(labels) === JSON.stringify(["Today", "Log", "Progress", "Coach", "More"]), `labels=${JSON.stringify(labels)}`);
        const small = tabs.filter((t) => t.w < 44 || t.h < 44);
        rec(`${key}/tap-targets`, small.length === 0, tabs.map((t) => `${t.label}:${t.w}x${t.h}`).join(", "));
        const active = tabs.filter((t) => t.ariaCurrent === "page").map((t) => t.label);
        rec(`${key}/aria-current`, active.length === 1 && active[0] === "Today", `aria-current=page on ${JSON.stringify(active)} (on /today want [Today])`);
      }
      await shot(page, `item3-${key}.png`);
      await ctx.close();
    }
  }

  // absence at 768 and 1440
  for (const w of [768, 1440]) {
    const ctx = await mkDesk(w, w === 768 ? 1024 : 900, "dark");
    const page = await ctx.newPage();
    attachConsole(page, `abs-${w}`);
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const barVisible = await page.isVisible(navSel).catch(() => false);
    rec(`bar-absent-${w}`, !barVisible, `bottom bar visible at ${w}px=${barVisible} (want false)`);
    await ctx.close();
  }

  // Log drawer: 5 logger destinations, no autofocus; More sheet: grouped
  {
    const ctx = await mkPhone(390, 844, "dark");
    const page = await ctx.newPage();
    attachConsole(page, "log-drawer");
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForSelector(navSel, { state: "visible", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Log", exact: true }).click();
    await page.waitForTimeout(500);
    const rows = await page.evaluate(() => {
      const scope = document.querySelector('[data-slot="drawer-content"]') || document;
      const wants = ["Log a meal", "Log water", "Log sleep", "Log a weigh-in", "Log a workout"];
      return wants.map((label) => {
        const a = Array.from(scope.querySelectorAll("a")).find((x) => x.textContent.trim() === label);
        return { label, found: !!a, href: a ? a.getAttribute("href") : null, h: a ? Math.round(a.getBoundingClientRect().height) : 0 };
      });
    });
    rec("log-drawer/5-destinations", rows.every((r) => r.found), rows.map((r) => r.found ? `${r.label}(${r.href})` : `${r.label}:MISSING`).join("; "));
    const activeEl = await page.evaluate(() => document.activeElement ? document.activeElement.tagName.toLowerCase() : "none");
    const vkOpen = await page.evaluate(() => document.documentElement.hasAttribute("data-vk-open"));
    rec("log-drawer/no-autofocus", !/^(input|textarea|select)$/.test(activeEl) && !vkOpen, `activeElement=${activeEl}, data-vk-open=${vkOpen}`);
    await shot(page, "item3-log-drawer-390-dark.png");
    // close, open More
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.waitForTimeout(500);
    const moreCaps = await page.evaluate(() => {
      const scope = document.querySelector('[data-slot="drawer-content"]') || document;
      const caps = Array.from(scope.querySelectorAll("p")).map((e) => e.textContent.trim()).filter((t) => ["Track", "Plan", "Review", "More"].includes(t));
      const hasQuit = Array.from(scope.querySelectorAll("a")).some((a) => /Quit Test/i.test(a.textContent));
      return { caps, hasQuit };
    });
    rec("more-sheet/grouped", ["Track", "Plan", "Review"].every((c) => moreCaps.caps.includes(c)), `captions=${JSON.stringify(moreCaps.caps)}; QuitTest present=${moreCaps.hasQuit}`);
    await page.evaluate(() => {
      const sc = document.querySelector('[data-slot="drawer-content"] .overflow-y-auto');
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await page.waitForTimeout(300);
    await shot(page, "item3-more-sheet-390-dark.png");
    await ctx.close();
  }

  // ================= ITEM 4: keyboard-safe =================
  // (a) chat composer
  {
    const ctx = await mkPhone(390, 844, "dark");
    const page = await ctx.newPage();
    attachConsole(page, "kbd-chat");
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.$eval('[data-testid="multimodal-input"]', (el) => el.focus());
    await page.waitForTimeout(300);
    const vkOpen = await page.evaluate(() => document.documentElement.hasAttribute("data-vk-open"));
    const bar = await page.evaluate((sel) => {
      const n = document.querySelector(sel);
      const r = n.getBoundingClientRect();
      return { top: Math.round(r.top), vh: window.innerHeight, cls: n.className.includes("translate-y-full") };
    }, navSel);
    rec("kbd-chat/vk-open", vkOpen, `html[data-vk-open]=${vkOpen}`);
    rec("kbd-chat/bar-hidden", bar.top >= bar.vh - 1 || bar.cls, `barTop=${bar.top} vh=${bar.vh} translate-y-full=${bar.cls}`);
    await shot(page, "item4-keyboard-chat-390.png");
    await page.$eval('[data-testid="multimodal-input"]', (el) => el.blur());
    await page.waitForTimeout(400);
    const restored = await page.evaluate((sel) => {
      const ok = !document.documentElement.hasAttribute("data-vk-open");
      const n = document.querySelector(sel);
      return { ok, cls: n.className.includes("translate-y-full") };
    }, navSel);
    rec("kbd-chat/restored-on-blur", restored.ok && !restored.cls, `data-vk-open removed=${restored.ok}, translate class gone=${!restored.cls}`);
    await ctx.close();
  }
  // (b) nutrition logger input
  {
    const ctx = await mkPhone(390, 844, "dark");
    const page = await ctx.newPage();
    attachConsole(page, "kbd-nutrition");
    await page.goto(`${BASE}/nutrition`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const focused = await page.evaluate(() => {
      const el = document.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]), textarea');
      if (!el) return false;
      el.focus();
      return true;
    });
    if (focused) {
      await page.waitForTimeout(300);
      const vkOpen = await page.evaluate(() => document.documentElement.hasAttribute("data-vk-open"));
      const bar = await page.evaluate((sel) => {
        const n = document.querySelector(sel);
        const r = n.getBoundingClientRect();
        return { top: Math.round(r.top), vh: window.innerHeight };
      }, navSel);
      rec("kbd-nutrition/vk-open+hidden", vkOpen && bar.top >= bar.vh - 1, `data-vk-open=${vkOpen} barTop=${bar.top} vh=${bar.vh}`);
      await shot(page, "item4-keyboard-nutrition-390.png");
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(400);
      const restored = await page.evaluate(() => !document.documentElement.hasAttribute("data-vk-open"));
      rec("kbd-nutrition/restored", restored, `data-vk-open removed=${restored}`);
    } else {
      rec("kbd-nutrition/vk-open+hidden", null, "no editable input found on /nutrition");
    }
    await ctx.close();
  }

  await browser.close();

  // ---- write findings ----
  const pass = results.filter((r) => r.pass === true).length;
  const fail = results.filter((r) => r.pass === false).length;
  const note = results.filter((r) => r.pass === null).length;
  let md = `# GATE-03 items 2/3/4/7 — grouped desktop nav, mobile bottom nav, keyboard-safe, console (fresh 2026-07-13)\n\nAgainst ${BASE}, Pro test account ${EMAIL}, read-only. Screenshots in ./gate03/.\n\n**Totals: ${pass} PASS / ${fail} FAIL / ${note} NOTE**\n\n| # | Assertion | Result | Detail |\n|---|---|---|---|\n`;
  results.forEach((r, i) => {
    const tag = r.pass === true ? "PASS" : r.pass === false ? "FAIL" : "NOTE";
    md += `| ${i + 1} | ${r.id} | ${tag} | ${r.detail.replace(/\|/g, "\\|")} |\n`;
  });
  // dedupe console errors by text
  const uniq = [...new Map(consoleErrors.map((e) => [e.text, e])).values()];
  md += `\n## Console errors (item 7) — ${uniq.length} unique\n\n`;
  if (uniq.length === 0) md += "None captured.\n";
  else for (const e of uniq) md += `- [${e.where}] ${e.text.slice(0, 300).replace(/\|/g, "\\|")}\n`;
  writeFileSync(`${OUT}/nav-fresh.md`, md);
  console.log(`\n=== ${pass} PASS / ${fail} FAIL / ${note} NOTE ===`);
  console.log(`console errors: ${uniq.length} unique`);
  console.log(`wrote ${OUT}/nav-fresh.md`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
