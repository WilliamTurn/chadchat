import { makeBrowser, ctxFor, BASE } from "./_lib.mjs";

const PATH = "/dev/fixtures/today-panels";
const { browser, authCookies } = await makeBrowser();

async function readRgb(theme) {
  const ctx = await ctxFor(browser, authCookies, { width: 1280, height: 1200 }, theme);
  const page = await ctx.newPage();
  await page.goto(`${BASE}${PATH}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const sec = [...document.querySelectorAll("section")].find(
      (s) => s.querySelector("h2") && s.querySelector("h2").textContent.trim() === "consistent"
    );
    const cards = [...sec.querySelectorAll("[data-panel-role]")];
    const waterCard = cards.find((c) => [...c.querySelectorAll("h2 span")].some((sp) => sp.textContent.trim() === "Water"));
    const gauge = waterCard.querySelector('[role="img"]');
    const labelSpan = [...gauge.querySelectorAll("span")].find((sp) => /\d/.test(sp.textContent) && sp.textContent.trim().endsWith("%"));
    const computed = getComputedStyle(labelSpan).color;
    // Convert whatever colorspace the browser reports into concrete sRGB bytes.
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const cx = cv.getContext("2d");
    cx.fillStyle = computed;
    cx.fillRect(0, 0, 1, 1);
    const [r, g, b] = cx.getImageData(0, 0, 1, 1).data;
    return { computed, rgb: `rgb(${r}, ${g}, ${b})`, r, g, b, text: labelSpan.textContent.trim() };
  });
  await ctx.close();
  return out;
}

console.log("DARK ", JSON.stringify(await readRgb("dark")));
console.log("LIGHT", JSON.stringify(await readRgb("light")));
await browser.close();
