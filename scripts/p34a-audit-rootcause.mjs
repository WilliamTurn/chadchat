import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34a", "audit");
const BASE = "http://localhost:3600";
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: join(OUT,"state.json"), viewport:{width:390,height:844}, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
const page = await ctx.newPage();
await page.goto(`${BASE}/`, { waitUntil:"domcontentloaded" });
await page.waitForTimeout(2000);
const r = await page.evaluate(() => {
  const banner = Array.from(document.querySelectorAll("*")).find(e => /Verify your email/.test(e.textContent) && e.children.length < 5);
  const col = document.querySelector('.pb-tabbar');
  const cr = col?.getBoundingClientRect();
  return {
    hasBanner: !!banner,
    bannerH: banner ? Math.round(banner.getBoundingClientRect().height) : 0,
    pbTabbarPadding: col ? getComputedStyle(col).paddingBottom : null,
    colTop: cr? Math.round(cr.top):null, colBottom: cr? Math.round(cr.bottom):null, colH: cr? Math.round(cr.height):null,
    viewportH: window.innerHeight,
    docScrolls: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    dvk: document.documentElement.hasAttribute('data-vk-open'),
  };
});
console.log("ROOTCAUSE:", JSON.stringify(r,null,1));
await browser.close();
