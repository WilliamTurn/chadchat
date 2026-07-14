import { makeBrowser, ctxFor, BASE } from "./_lib.mjs";

const { browser, authCookies } = await makeBrowser();
const ctx = await ctxFor(browser, authCookies, { width: 1440, height: 900 }, "dark");
const page = await ctx.newPage();

await page.goto(`${BASE}/hydration`, { waitUntil: "load" });
await page.waitForTimeout(2600);

const before = await page.evaluate(() =>
  [...document.querySelectorAll("#history div.rounded-xl.border")].map((r) => r.textContent.replace(/\s+/g, " ").trim().slice(0, 40))
);
console.log("BEFORE:", JSON.stringify(before));

// Delete every history entry that is NOT the pre-existing Jul 11 day.
let guard = 0;
while (guard++ < 15) {
  const target = page.locator("#history div.rounded-xl.border").filter({ hasNotText: "Jul 11" }).first();
  if (!(await target.count())) break;
  // expand
  await target.getByRole("button").first().click();
  await page.waitForTimeout(700);
  const entryDelete = target.locator("ul li").getByRole("button", { name: "Delete" }).first();
  if (!(await entryDelete.count())) { console.log("no entry delete; stopping"); break; }
  await entryDelete.click();
  await page.waitForTimeout(700);
  const conf = page.getByRole("button", { name: /Delete entry/i });
  if (await conf.count()) { await conf.click(); await page.waitForTimeout(2800); }
  await page.goto(`${BASE}/hydration`, { waitUntil: "load" });
  await page.waitForTimeout(2400);
}

const after = await page.evaluate(() =>
  [...document.querySelectorAll("#history div.rounded-xl.border")].map((r) => r.textContent.replace(/\s+/g, " ").trim().slice(0, 40))
);
console.log("AFTER:", JSON.stringify(after));
console.log("=== CLEANUP DONE ===");
await ctx.close();
await browser.close();
