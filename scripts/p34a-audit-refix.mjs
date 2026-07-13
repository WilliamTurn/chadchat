// P34-A audit re-verification after coordinator fixes:
// A. chat 390 with banner: no doc scroll, disclaimer above bar, composer visible/clickable
// B. focus composer: bar hides, pb-tabbar collapses to 0
// C. desktop 1440 chat sanity
// D. /today 390 regression
// Read-only against SHARED PROD DB.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34a", "audit");
const BASE = "http://localhost:3600";
const navSel = 'nav[aria-label="Primary"]';
const out = {};
const log = (m) => console.log(m);

const browser = await chromium.launch();

// ---- A + B: phone chat ----
const mctx = await browser.newContext({
  storageState: join(OUT, "state.json"),
  viewport: { width: 390, height: 844 },
  hasTouch: true, isMobile: true, deviceScaleFactor: 2,
});
const page = await mctx.newPage();
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

out.A = await page.evaluate((sel) => {
  const nav = document.querySelector(sel);
  const navTop = nav ? Math.round(nav.getBoundingClientRect().top * 10) / 10 : null;
  const banner = Array.from(document.querySelectorAll("*")).find(e => /Verify your email/.test(e.textContent) && e.children.length < 5);
  const col = document.querySelector('.pb-tabbar');
  const cr = col?.getBoundingClientRect();
  const ta = document.querySelector("textarea");
  const tr = ta?.getBoundingClientRect();
  const discl = Array.from(document.querySelectorAll("p")).find(p => /Chad is an AI/.test(p.textContent));
  const dr = discl?.getBoundingClientRect();
  return {
    bannerPresent: !!banner,
    colTop: cr ? Math.round(cr.top) : null,
    colBottom: cr ? Math.round(cr.bottom * 10) / 10 : null,
    viewportH: window.innerHeight,
    docScrolls: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    docScrollH: document.documentElement.scrollHeight,
    navTop,
    disclBottom: dr ? Math.round(dr.bottom * 10) / 10 : null,
    disclAboveBar: (dr && navTop !== null) ? dr.bottom <= navTop + 0.5 : null,
    composer: tr ? { top: Math.round(tr.top), bottom: Math.round(tr.bottom), fullyVisible: tr.top >= 0 && tr.bottom <= (navTop ?? window.innerHeight) } : null,
    pbTabbarPadding: col ? getComputedStyle(col).paddingBottom : null,
  };
}, navSel);
log(`A: ${JSON.stringify(out.A, null, 1)}`);
await page.screenshot({ path: join(OUT, "refix-chat-390.png") });

// composer clickable: tap it and confirm focus lands on the textarea
const ta = await page.$("textarea");
await ta.tap();
await page.waitForTimeout(700);
out.B = await page.evaluate((sel) => {
  const nav = document.querySelector(sel);
  const col = document.querySelector('.pb-tabbar');
  return {
    activeEl: document.activeElement?.tagName,
    vkOpen: document.documentElement.hasAttribute("data-vk-open"),
    barTransform: nav ? getComputedStyle(nav).transform : null,
    barHidden: nav ? getComputedStyle(nav).transform !== "none" : null,
    pbTabbarPaddingFocused: col ? getComputedStyle(col).paddingBottom : null,
  };
}, navSel);
log(`B: ${JSON.stringify(out.B, null, 1)}`);
await page.screenshot({ path: join(OUT, "refix-chat-390-focused.png") });
// blur restores
await page.evaluate(() => document.activeElement.blur());
await page.waitForTimeout(700);
out.Bblur = await page.evaluate((sel) => {
  const nav = document.querySelector(sel);
  const col = document.querySelector('.pb-tabbar');
  return { vkOpen: document.documentElement.hasAttribute("data-vk-open"), barTransform: nav ? getComputedStyle(nav).transform : null, pbTabbarPadding: col ? getComputedStyle(col).paddingBottom : null };
}, navSel);
log(`B(blur): ${JSON.stringify(out.Bblur)}`);

// ---- D: /today 390 regression ----
await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
out.D = await page.evaluate((sel) => {
  const nav = document.querySelector(sel);
  const r = nav?.getBoundingClientRect();
  return {
    barPresent: !!nav,
    barTop: r ? Math.round(r.top) : null,
    barBottom: r ? Math.round(r.bottom) : null,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
}, navSel);
log(`D: ${JSON.stringify(out.D)}`);
await page.screenshot({ path: join(OUT, "refix-today-390.png") });
await mctx.close();

// ---- C: desktop 1440 chat ----
const dctx = await browser.newContext({
  storageState: join(OUT, "state.json"),
  viewport: { width: 1440, height: 900 },
});
const dp = await dctx.newPage();
await dp.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await dp.waitForTimeout(2500);
out.C = await dp.evaluate(() => {
  const hdr = document.querySelector("header");
  const ta = document.querySelector("textarea");
  const tr = ta?.getBoundingClientRect();
  const nav = document.querySelector('nav[aria-label="Primary"]');
  const navCS = nav ? getComputedStyle(nav) : null;
  return {
    headerVisible: hdr ? hdr.getBoundingClientRect().height > 0 : false,
    composer: tr ? { top: Math.round(tr.top), bottom: Math.round(tr.bottom), visible: tr.top >= 0 && tr.bottom <= window.innerHeight } : null,
    docScrolls: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    bodyScrolls: document.body.scrollHeight > document.body.clientHeight,
    barDisplay: navCS ? navCS.display : null,
    viewportH: window.innerHeight,
    docScrollH: document.documentElement.scrollHeight,
  };
});
log(`C: ${JSON.stringify(out.C, null, 1)}`);
await dp.screenshot({ path: join(OUT, "refix-chat-1440.png") });
await dctx.close();

writeFileSync(join(OUT, "refix.json"), JSON.stringify(out, null, 2));
await browser.close();
log("DONE refix");
