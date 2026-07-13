// P34-A audit follow-up: close affordances (Escape/X/scrim), hamburger+More
// sequence, chat sidebar drawer coexistence. Read-only.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34a", "audit");
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
const navSel = 'nav[aria-label="Primary"]';
const shot = async (n) => { await page.screenshot({ path: join(OUT, n) }); };
const drawerOpen = () => page.evaluate(() => !!document.querySelector('[data-slot="drawer-content"], [vaul-drawer], [data-vaul-drawer]'));
async function openBarSheet(kind) {
  const btns = await page.$$(`${navSel} button`);
  for (const b of btns) { if ((await b.textContent()).trim().includes(kind)) { await b.tap(); break; } }
  await page.waitForTimeout(700);
}

// ---- Close affordances on the Log sheet ----
await page.goto(`${BASE}/help`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);

// Escape (wait long enough for exit anim)
await openBarSheet("Log");
const openedForEsc = await drawerOpen();
await page.keyboard.press("Escape");
await page.waitForTimeout(1000);
out.escape = { openedBefore: openedForEsc, closedAfter: !(await drawerOpen()) };
log(`Escape: opened=${openedForEsc} closed=${out.escape.closedAfter}`);

// X button
await openBarSheet("Log");
const xInfo = await page.evaluate(() => {
  const btn = document.querySelector('[data-slot="drawer-content"] button [class],[data-slot="drawer-content"] button');
  const closeBtn = Array.from(document.querySelectorAll('[data-slot="drawer-content"] button')).find(b => b.querySelector('svg') && /close/i.test(b.textContent + (b.getAttribute('aria-label')||'')) || (b.querySelector('.sr-only')?.textContent||'').includes('Close'));
  if (closeBtn) { closeBtn.setAttribute('data-audit-x',''); const r=closeBtn.getBoundingClientRect(); return {found:true,w:Math.round(r.width),h:Math.round(r.height)}; }
  return {found:false};
});
if (xInfo.found) {
  await page.tap('[data-audit-x]');
  await page.waitForTimeout(900);
  out.xClose = { ...xInfo, closed: !(await drawerOpen()) };
} else out.xClose = { found:false };
log(`X close: ${JSON.stringify(out.xClose)}`);

// ---- hamburger (top-right) then More (bottom bar) sequence ----
await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Open menu' }).tap();
await page.waitForTimeout(700);
out.hamburger = await page.evaluate(() => {
  const sheet = document.querySelector('[data-slot="sheet-content"], [role="dialog"]');
  const ae = document.activeElement;
  return { opened: !!sheet, activeEl: ae?.tagName, editable: ae?.isContentEditable || ['INPUT','TEXTAREA'].includes(ae?.tagName), sheetH: sheet? Math.round(sheet.getBoundingClientRect().height):0, vh: window.innerHeight };
});
log(`hamburger: ${JSON.stringify(out.hamburger)}`);
await shot("hamburger-sheet-390.png");
// close hamburger, open More
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
out.hambClosed = !(await page.evaluate(() => !!document.querySelector('[data-slot="sheet-content"]')));
await openBarSheet("More");
out.moreAfterHamb = { opened: await drawerOpen() };
const moreScroll = await page.evaluate(() => {
  const d = document.querySelector('[data-slot="drawer-content"]');
  if (!d) return null;
  const inner = d.querySelector('div');
  return { drawerH: Math.round(d.getBoundingClientRect().height), vh: window.innerHeight, scrollH: d.scrollHeight, clientH: d.clientHeight, linkCount: d.querySelectorAll('a').length };
});
out.moreAfterHamb.scroll = moreScroll;
log(`More after hamburger closed(${out.hambClosed}): opened=${out.moreAfterHamb.opened} ${JSON.stringify(moreScroll)}`);
await shot("more-sheet-scroll.png");
// can we reach the last link (Help)? scroll the drawer
await page.evaluate(() => { const d=document.querySelector('[data-slot="drawer-content"]'); if(d) d.scrollTop = d.scrollHeight; });
await page.waitForTimeout(400);
await shot("more-sheet-scrolled-bottom.png");
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// ---- chat sidebar drawer coexistence ----
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
// first button in chat header is the sidebar toggle (PanelLeftIcon, no label)
const toggled = await page.evaluate(() => {
  const hdr = document.querySelector('header');
  const b = hdr?.querySelector('button');
  if (b) { b.setAttribute('data-audit-sb',''); return true; }
  return false;
});
if (toggled) {
  await page.tap('[data-audit-sb]');
  await page.waitForTimeout(800);
  out.chatSidebar = await page.evaluate((navSel) => {
    const nav = document.querySelector(navSel);
    const sheet = document.querySelector('[data-slot="sheet-content"], [data-mobile="true"]');
    const navCS = nav ? getComputedStyle(nav) : null;
    const sheetCS = sheet ? getComputedStyle(sheet) : null;
    // is the bar visible over/under the sheet?
    const navRect = nav?.getBoundingClientRect();
    return {
      sidebarOpened: !!sheet,
      navZ: navCS?.zIndex, sheetZ: sheetCS?.zIndex,
      navTransform: navCS?.transform,
      navBottom: navRect? Math.round(navRect.bottom):null,
      sheetCoversBar: sheet && nav ? (sheetCS.zIndex >= navCS.zIndex) : null,
    };
  }, navSel);
  log(`chat sidebar: ${JSON.stringify(out.chatSidebar)}`);
  await shot("chat-sidebar-open.png");
} else out.chatSidebar = { note: "toggle not found" };

writeFileSync(join(OUT, "close.json"), JSON.stringify(out, null, 2));
await browser.close();
log("DONE close");
