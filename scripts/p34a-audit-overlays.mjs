// P34-A audit: overlays (Log/More sheets) from top/mid/bottom scroll, close
// affordances, activeElement-not-editable on open, chat surface + keyboard hide,
// hamburger vs More sequence. Read-only.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34a", "audit");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3600";
const out = {};
const log = (m) => console.log(m);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: join(OUT, "state.json"),
  viewport: { width: 390, height: 844 },
  hasTouch: true, isMobile: true, deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const shot = async (n) => { await page.screenshot({ path: join(OUT, n) }); };
const navSel = 'nav[aria-label="Primary"]';

async function activeElInfo() {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return { tag: null };
    return { tag: a.tagName, type: a.getAttribute("type"), editable: a.isContentEditable, cls: (a.className||'').toString().slice(0,60) };
  });
}
async function openSheet(kind) {
  // kind: 'Log' or 'More'
  const btns = await page.$$(`${navSel} button`);
  for (const b of btns) {
    const t = (await b.textContent()).trim();
    if (t.includes(kind)) { await b.tap(); break; }
  }
  await page.waitForTimeout(600);
}
async function drawerBox() {
  return page.evaluate(() => {
    const d = document.querySelector('[data-vaul-drawer], [role=dialog]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), vh: window.innerHeight, bg: cs.backgroundColor, opacity: cs.opacity, overflowY: cs.overflowY, scrollH: d.scrollHeight, clientH: d.clientHeight };
  });
}

// ---- 1. Log + More sheets from top/mid/bottom on a long page (/help) ----
for (const kind of ["Log", "More"]) {
  out[kind] = {};
  for (const pos of ["top", "mid", "bottom"]) {
    await page.goto(`${BASE}/help`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    if (pos === "mid") await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight/2));
    if (pos === "bottom") await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await openSheet(kind);
    const box = await drawerBox();
    const ae = await activeElInfo();
    const inView = box ? (box.top >= 0 && box.bottom <= box.vh + 2 && box.h > 0) : false;
    out[kind][pos] = { box, activeEl: ae, inViewport: inView, activeEditable: ae.editable || ["INPUT","TEXTAREA"].includes(ae.tag) };
    log(`${kind}@${pos}: inView=${inView} box=${box?JSON.stringify({top:box.top,bottom:box.bottom,vh:box.vh}):'NONE'} bg=${box?box.bg:'-'} scrollable=${box?box.scrollH>box.clientH:'-'} activeEl=${ae.tag}/${ae.type} editable=${ae.editable}`);
    if (pos === "bottom") await shot(`overlay-${kind}-bottom.png`);
    // close via Escape and see where focus lands
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const stillOpen = await drawerBox();
    const afterFocus = await activeElInfo();
    out[kind][pos].closedByEscape = !stillOpen;
    out[kind][pos].focusAfterClose = afterFocus;
    log(`  escape closed=${!stillOpen} focusAfter=${afterFocus.tag}`);
  }
}

// ---- 2. scrim tap close (Log sheet) ----
await page.goto(`${BASE}/help`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await openSheet("Log");
let box = await drawerBox();
// tap top-left corner (scrim area, above the sheet)
await page.mouse.click(10, 10);
await page.waitForTimeout(500);
out.scrimClose = { closed: !(await drawerBox()) };
log(`scrim tap close (Log): closed=${out.scrimClose.closed}`);

// ---- 3. hamburger sheet then More sheet in sequence ----
await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
// open hamburger (StandaloneHeader) - find a header button with menu
const hamb = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll("header button, button"));
  const h = btns.find(b => /menu|open menu|navigation/i.test(b.getAttribute("aria-label")||"") );
  if (h) { h.setAttribute("data-audit-hamb",""); return true; }
  return false;
});
if (hamb) {
  await page.tap('[data-audit-hamb]');
  await page.waitForTimeout(600);
  const hambBox = await drawerBox();
  const hambAe = await activeElInfo();
  out.hamburger = { opened: !!hambBox, activeEl: hambAe, box: hambBox };
  log(`hamburger opened=${!!hambBox} activeEl=${hambAe.tag} editable=${hambAe.editable}`);
  await shot("hamburger-sheet.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
} else {
  out.hamburger = { opened: false, note: "no hamburger button found via aria-label" };
  log("hamburger: not found");
}
// now open More
await openSheet("More");
out.moreAfterHamb = { opened: !!(await drawerBox()) };
log(`More after hamburger: opened=${out.moreAfterHamb.opened}`);
await shot("more-sheet-390.png");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// ---- 4. Chat surface: bar + composer + keyboard hide + sidebar drawer ----
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const barBefore = await page.$eval(navSel, n => { const r=n.getBoundingClientRect(); return {top:Math.round(r.top), tf:getComputedStyle(n).transform}; }).catch(()=>null);
// composer / disclaimer vs bar
const composerInfo = await page.evaluate((sel) => {
  const nav = document.querySelector(sel);
  const navTop = nav ? nav.getBoundingClientRect().top : null;
  const ta = document.querySelector("textarea");
  const discl = Array.from(document.querySelectorAll("p")).find(p => /Chad is an AI/.test(p.textContent));
  return {
    navTop,
    composerBottom: ta ? Math.round(ta.getBoundingClientRect().bottom) : null,
    disclBottom: discl ? Math.round(discl.getBoundingClientRect().bottom) : null,
    disclTop: discl ? Math.round(discl.getBoundingClientRect().top) : null,
  };
}, navSel);
out.chat = { barBefore, composerInfo };
log(`chat: barTop=${barBefore?.top} composerBottom=${composerInfo.composerBottom} disclBottom=${composerInfo.disclBottom} navTop=${composerInfo.navTop}`);
await shot("chat-390.png");
// focus composer -> bar should hide (translate-y-full) + data-vk-open set
const ta = await page.$("textarea");
if (ta) {
  await ta.tap();
  await page.waitForTimeout(600);
  const vk = await page.evaluate(() => document.documentElement.hasAttribute("data-vk-open"));
  const barAfter = await page.$eval(navSel, n => getComputedStyle(n).transform).catch(()=>null);
  const aeOnFocus = await activeElInfo();
  out.chat.focusComposer = { vkOpen: vk, barTransform: barAfter, activeEl: aeOnFocus.tag };
  log(`chat focus composer: data-vk-open=${vk} barTransform=${barAfter} activeEl=${aeOnFocus.tag}`);
  await shot("chat-composer-focused.png");
  // blur
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(600);
  const vk2 = await page.evaluate(() => document.documentElement.hasAttribute("data-vk-open"));
  const barBack = await page.$eval(navSel, n => getComputedStyle(n).transform).catch(()=>null);
  out.chat.blurComposer = { vkOpen: vk2, barTransform: barBack };
  log(`chat blur composer: data-vk-open=${vk2} barTransform=${barBack}`);
}
// open chat sidebar drawer (hamburger in chat header)
const chatHamb = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll("button"));
  const h = btns.find(b => /menu|sidebar|toggle/i.test(b.getAttribute("aria-label")||""));
  if (h) { h.setAttribute("data-audit-ch",""); return h.getAttribute("aria-label"); }
  return null;
});
if (chatHamb) {
  await page.tap('[data-audit-ch]');
  await page.waitForTimeout(700);
  const barPeek = await page.evaluate((sel) => {
    const nav = document.querySelector(sel); if (!nav) return null;
    const r = nav.getBoundingClientRect(); const cs = getComputedStyle(nav);
    // find sidebar overlay z
    const sb = document.querySelector('[data-sidebar], [role=dialog], aside');
    return { navZ: cs.zIndex, navVisible: r.height>0 && cs.transform.indexOf('matrix')===-1 ? true : cs.transform, sidebarZ: sb? getComputedStyle(sb).zIndex : null };
  }, navSel);
  out.chat.sidebarDrawer = { hambLabel: chatHamb, barInfo: barPeek };
  log(`chat sidebar drawer (${chatHamb}): navZ=${barPeek?.navZ} sidebarZ=${barPeek?.sidebarZ}`);
  await shot("chat-sidebar-drawer.png");
} else {
  out.chat.sidebarDrawer = { note: "no chat hamburger found" };
  log("chat sidebar drawer: hamburger not found");
}

writeFileSync(join(OUT, "overlays.json"), JSON.stringify(out, null, 2));
await browser.close();
log("DONE overlays");
