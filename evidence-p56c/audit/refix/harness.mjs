import { makeBrowser, ctxFor, BASE } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const OUT = "C:/Users/jon17/Desktop/chadchat/evidence-p56c/audit/refix";
const PATH = "/dev/fixtures/today-panels";
const { browser, authCookies } = await makeBrowser();
const log = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };

/* ============ ITEM 5: title wrap at 320 (dark) ============ */
{
  const ctx = await ctxFor(browser, authCookies, { width: 320, height: 900 }, "dark");
  const page = await ctx.newPage();
  await page.goto(`${BASE}${PATH}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const item5 = await page.evaluate(() => {
    const spans = [...document.querySelectorAll("h2 span")].filter((s) => s.textContent.trim() === "Calorie Tracker");
    if (spans.length === 0) return { error: "no Calorie Tracker title span" };
    const s = spans[0];
    const cs = getComputedStyle(s);
    const r = s.getBoundingClientRect();
    return {
      count: spans.length,
      text: s.textContent.trim(),
      className: s.className,
      scrollWidth: s.scrollWidth,
      clientWidth: s.clientWidth,
      notEllipsized: s.scrollWidth <= s.clientWidth + 1,
      whiteSpace: cs.whiteSpace,
      textOverflow: cs.textOverflow,
      overflow: cs.overflow,
      rectHeight: Math.round(r.height),
      lineHeight: cs.lineHeight,
      rectTop: Math.round(r.top),
      rectLeft: Math.round(r.left),
    };
  });
  rec({ step: "ITEM5-title-wrap-320", item5 });
  // Screenshot the header of the first Calorie Tracker card.
  const clip = await page.evaluate(() => {
    const span = [...document.querySelectorAll("h2 span")].find((s) => s.textContent.trim() === "Calorie Tracker");
    const header = span?.closest("div");
    const card = span?.closest("[data-panel-role]") || header;
    const r = (card || header).getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.left) - 4), y: Math.max(0, Math.round(r.top) - 4), width: Math.min(320, Math.round(r.width) + 8), height: Math.min(160, Math.round(r.height) + 8) };
  });
  await page.screenshot({ path: `${OUT}/05-calorie-title-320-dark.png`, clip });
  await ctx.close();
}

/* ============ ITEM 6: gauge percent label ink (both themes) ============ */
async function gaugeInk(theme) {
  const ctx = await ctxFor(browser, authCookies, { width: 1280, height: 1200 }, theme);
  const page = await ctx.newPage();
  await page.goto(`${BASE}${PATH}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => {
    const sections = [...document.querySelectorAll("section")];
    const sec = sections.find((s) => {
      const h2 = s.querySelector("h2");
      return h2 && h2.textContent.trim() === "consistent";
    });
    if (!sec) return { error: "no consistent section" };
    // The Water panel card inside this persona section.
    const cards = [...sec.querySelectorAll("[data-panel-role]")];
    const waterCard = cards.find((c) => [...c.querySelectorAll("h2 span")].some((sp) => sp.textContent.trim() === "Water"));
    if (!waterCard) return { error: "no Water card in consistent section" };
    const gauge = waterCard.querySelector('[role="img"]');
    if (!gauge) return { error: "no gauge" };
    // The percent label span (font-display, ends with %).
    const labelSpan = [...gauge.querySelectorAll("span")].find((sp) => /\d/.test(sp.textContent) && sp.textContent.trim().endsWith("%"));
    if (!labelSpan) return { error: "no percent label", gaugeText: gauge.textContent };
    const cs = getComputedStyle(labelSpan);
    return {
      labelText: labelSpan.textContent.trim(),
      className: labelSpan.className,
      color: cs.color,
      gaugeAria: gauge.getAttribute("aria-label"),
    };
  });
  await page.screenshot({ path: `${OUT}/06-gauge-ink-${theme}.png`, fullPage: false });
  // A tighter crop of just the consistent Water gauge.
  try {
    const clip = await page.evaluate(() => {
      const sections = [...document.querySelectorAll("section")];
      const sec = sections.find((s) => s.querySelector("h2") && s.querySelector("h2").textContent.trim() === "consistent");
      const cards = [...sec.querySelectorAll("[data-panel-role]")];
      const waterCard = cards.find((c) => [...c.querySelectorAll("h2 span")].some((sp) => sp.textContent.trim() === "Water"));
      const r = waterCard.getBoundingClientRect();
      return { x: Math.max(0, Math.round(r.left) - 4), y: Math.max(0, Math.round(r.top) - 4), width: Math.round(r.width) + 8, height: Math.round(r.height) + 8 };
    });
    await page.screenshot({ path: `${OUT}/06-gauge-ink-${theme}-crop.png`, clip });
  } catch {}
  await ctx.close();
  return data;
}
const darkInk = await gaugeInk("dark");
rec({ step: "ITEM6-gauge-ink-dark", darkInk });
const lightInk = await gaugeInk("light");
rec({ step: "ITEM6-gauge-ink-light", lightInk });

// Evaluate sky-950 expectation.
function classify(color) {
  const m = (color || "").match(/rgba?\(([^)]+)\)/);
  if (!m) return { color, ok: false };
  const [r, g, b] = m[1].split(",").map((x) => parseFloat(x));
  const isSky950 = r === 8 && g === 47 && b === 73;
  const isDarkInk = r < 40 && g < 70 && b < 100;
  const isWhite = r > 240 && g > 240 && b > 240;
  return { color, r, g, b, isSky950, isDarkInk, isWhite };
}
rec({ step: "ITEM6-classify", dark: classify(darkInk?.color), light: classify(lightInk?.color) });

writeFileSync(`${OUT}/harness.json`, JSON.stringify(log, null, 2));
console.log("=== HARNESS DONE ===");
await browser.close();
