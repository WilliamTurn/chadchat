import { makeBrowser, ctxFor, BASE, OUT } from "./_lib.mjs";
import { writeFileSync } from "node:fs";
const { browser, authCookies } = await makeBrowser();
const log = []; const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };
const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 900 }, "dark");
const page = await ctx.newPage();
async function inViewport(tag) {
  return await page.evaluate((tag) => {
    const d = document.querySelector('[role="dialog"],[role="alertdialog"]'); if (!d) return { tag, present: false };
    const r = d.getBoundingClientRect();
    return { tag, present: true, inViewport: r.top >= -1 && r.bottom <= window.innerHeight + 1, top: Math.round(r.top), bottom: Math.round(r.bottom), scrollY: Math.round(window.scrollY) };
  }, tag);
}
for (const [path, name, primary] of [["/hydration", "hyd", "Log water"], ["/sleep", "slp", "Log last night"]]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" }); await page.waitForTimeout(2200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: primary, exact: true }).first().click();
  await page.waitForTimeout(600);
  rec({ step: `${name}-bottomscroll-open`, ...(await inViewport(name)) });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
}
writeFileSync(`${OUT}/bottomscroll.json`, JSON.stringify(log, null, 2));
await ctx.close(); await browser.close();
console.log("done");
