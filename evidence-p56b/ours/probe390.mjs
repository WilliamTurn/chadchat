import { chromium } from "@playwright/test";
const BASE = "http://localhost:3600";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await c.newPage();
await p.goto(`${BASE}/dev/fixtures/training`, { waitUntil: "networkidle" });
await p.evaluate(() => { document.documentElement.classList.add("dark"); });
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(2500);
await p.locator('section[aria-label="consistent"]').scrollIntoViewIfNeeded();
await p.waitForTimeout(400);

const dump = await p.evaluate(() => {
  const sec = document.querySelector('section[aria-label="consistent"]');
  const h = [...sec.querySelectorAll("h3")].find(n => n.textContent.trim() === "Training consistency");
  const fig = h.closest("figure");
  // find ALL elements inside the figure with a red-ish background and size
  const out = [];
  [...fig.querySelectorAll("*")].forEach(el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const bg = s.backgroundColor;
    const big = r.width >= 24 || r.height >= 24;
    const painted = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
    if (painted && big && r.width < 200 && r.height < 200) {
      out.push({
        tag: el.tagName,
        cls: el.className?.toString().slice(0, 70),
        w: Math.round(r.width), hgt: Math.round(r.height),
        bg: bg.slice(0, 30),
        txt: (el.textContent || "").trim().slice(0, 20),
      });
    }
  });
  // also: list the direct child structure of the figure body
  const body = fig.querySelector('[role="img"]') || fig;
  const kids = [...body.children].map(k => ({
    tag: k.tagName, cls: k.className?.toString().slice(0, 80),
    w: Math.round(k.getBoundingClientRect().width),
    h: Math.round(k.getBoundingClientRect().height),
  }));
  return { paintedBig: out.slice(0, 12), bodyKids: kids, figHTML: fig.innerHTML.length };
});
console.log(JSON.stringify(dump, null, 2));
await b.close();
