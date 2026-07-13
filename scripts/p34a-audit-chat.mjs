// P34-A audit: chat composer/disclaimer vs bar, keyboard-hide behavior. Read-only.
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
const ctx = await browser.newContext({
  storageState: join(OUT, "state.json"),
  viewport: { width: 390, height: 844 },
  hasTouch: true, isMobile: true, deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const shot = async (n) => { await page.screenshot({ path: join(OUT, n) }); };

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
out.layout = await page.evaluate((sel) => {
  const nav = document.querySelector(sel);
  const navTop = nav ? Math.round(nav.getBoundingClientRect().top) : null;
  const ta = document.querySelector("textarea");
  const discl = Array.from(document.querySelectorAll("p")).find(p => /Chad is an AI/.test(p.textContent));
  return {
    navTop,
    composerBottom: ta ? Math.round(ta.getBoundingClientRect().bottom) : null,
    disclBottom: discl ? Math.round(discl.getBoundingClientRect().bottom) : null,
    disclTop: discl ? Math.round(discl.getBoundingClientRect().top) : null,
    disclUnderBar: (discl && nav) ? discl.getBoundingClientRect().bottom > nav.getBoundingClientRect().top + 2 : null,
  };
}, navSel);
log(`chat layout: ${JSON.stringify(out.layout)}`);
await shot("chat-bar-composer.png");

// focus composer -> bar hides + data-vk-open
const ta = await page.$("textarea");
if (ta) {
  await ta.tap();
  await page.waitForTimeout(700);
  out.focus = await page.evaluate((sel) => {
    const nav = document.querySelector(sel);
    return {
      vkOpen: document.documentElement.hasAttribute("data-vk-open"),
      barTransform: nav ? getComputedStyle(nav).transform : null,
      activeEl: document.activeElement?.tagName,
    };
  }, navSel);
  log(`focus composer: ${JSON.stringify(out.focus)}`);
  await shot("chat-composer-focused.png");
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(700);
  out.blur = await page.evaluate((sel) => {
    const nav = document.querySelector(sel);
    return { vkOpen: document.documentElement.hasAttribute("data-vk-open"), barTransform: nav ? getComputedStyle(nav).transform : null };
  }, navSel);
  log(`blur composer: ${JSON.stringify(out.blur)}`);
}
writeFileSync(join(OUT, "chat.json"), JSON.stringify(out, null, 2));
await browser.close();
log("DONE chat");
