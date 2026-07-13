// P34-Z performance measurement — /today (prod build on :3601)
// Reproduces the P2-A / P2-Z method EXACTLY for an apples-to-apples diff:
//   production `next start` (:3601, already running — never started/stopped here),
//   dark theme (app default), buffered PerformanceObserver (LCP + layout-shift),
//   median of 3 cold runs (fresh context each), Pro test account on /today.
// First-load JS = compressed transfer bytes (CDP encodedDataLength) of the .js
// chunks the initial /today HTML document references (script src + preloads),
// intersected with what was observed on the wire.
// READ-ONLY. No submit/save/delete. No real member data logged.
import { chromium } from "@playwright/test";
import { encode, decode } from "next-auth/jwt";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34z");
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3601";
const EMAIL = "claude-testing@example.com";
const PASSWORD = "12345678";
const NONSECURE = "authjs.session-token";
const SECURE = "__Secure-authjs.session-token";

// AUTH_SECRET from .env.local (mirrors the app runtime)
const envLocal = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const secret = envLocal
  .split(/\r?\n/)
  .find((l) => l.startsWith("AUTH_SECRET="))
  ?.slice("AUTH_SECRET=".length)
  .trim()
  .replace(/^["']|["']$/g, "");
if (!secret) throw new Error("AUTH_SECRET not found in .env.local");

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

// ---- 1. Real credential login → non-secure cookie, then mint the __Secure- twin ----
const browser = await chromium.launch();
const loginCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const lp = await loginCtx.newPage();
await lp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await lp.waitForTimeout(1200);
const robustFill = async (sel, val) => {
  for (let i = 0; i < 6; i++) {
    await lp.fill(sel, val);
    await lp.waitForTimeout(150);
    if ((await lp.inputValue(sel)) === val) return true;
  }
  return false;
};
await robustFill('input[type="email"]', EMAIL);
await robustFill('input[type="password"]', PASSWORD);
await lp.getByRole("button", { name: "Sign in", exact: true }).click();
await lp.waitForTimeout(3500);

const cookies = await loginCtx.cookies();
const nonSecure = cookies.find((c) => c.name === NONSECURE);
if (!nonSecure) {
  console.error("cookies present:", cookies.map((c) => c.name));
  throw new Error("login did not set authjs.session-token");
}
// decode with the non-secure salt, re-encode with the secure salt (AuthJS v5:
// salt = cookie name). Both cookies live in the jar together.
const payload = await decode({ token: nonSecure.value, secret, salt: NONSECURE });
const secureJwt = await encode({ token: payload, secret, salt: SECURE, maxAge: 30 * 24 * 60 * 60 });
const authCookies = [
  { name: NONSECURE, value: nonSecure.value, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
  { name: SECURE, value: secureJwt, domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
];
await loginCtx.close();
console.log("auth ready: minted __Secure- twin for user", payload.email ?? payload.id);

// buffered PerformanceObserver injected before any app JS runs
const OBSERVER = `
  window.__lcp = 0; window.__cls = 0; window.__lcpEntries = 0; window.__clsEntries = 0;
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) { window.__lcp = e.startTime; window.__lcpEntries++; }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!e.hadRecentInput) { window.__cls += e.value; window.__clsEntries++; }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (err) { window.__obsErr = String(err); }
`;

const basename = (u) => (u || "").split("?")[0].split("#")[0].split("/").pop();

async function coldRun(viewport, measureJs) {
  const ctx = await browser.newContext({ viewport, colorScheme: "dark", bypassCSP: true });
  await ctx.addCookies(authCookies);
  await ctx.addInitScript(OBSERVER);
  const page = await ctx.newPage();

  // CDP: real compressed bytes on the wire
  const wire = new Map();       // url -> encodedDataLength
  const jsMime = new Map();     // requestId -> url (js only)
  const idToUrl = new Map();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  cdp.on("Network.responseReceived", (p) => {
    idToUrl.set(p.requestId, p.response.url);
    const isJs = p.response.url.endsWith(".js") || (p.response.mimeType || "").includes("javascript");
    if (isJs) jsMime.set(p.requestId, p.response.url);
  });
  cdp.on("Network.loadingFinished", (p) => {
    const url = jsMime.get(p.requestId);
    if (url) wire.set(url, (wire.get(url) || 0) + p.encodedDataLength);
  });

  const resp = await page.goto(`${BASE}/today`, { waitUntil: "load", timeout: 60000 });
  const status = resp?.status();
  const finalUrl = page.url();
  await page.waitForTimeout(2500);
  // scroll to force any deferred shift, then settle (matches prior method)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  const vitals = await page.evaluate(() => ({
    lcp: window.__lcp, cls: window.__cls,
    lcpEntries: window.__lcpEntries, clsEntries: window.__clsEntries,
    obsErr: window.__obsErr || null,
    docHeight: document.documentElement.scrollHeight,
    react310: !!document.body?.innerText?.includes("Minified React error #310"),
  }));

  let jsResult = null;
  if (measureJs) {
    // parse the raw /today HTML for referenced chunk URLs (script src + preloads)
    const html = await fetch(`${BASE}/today`, {
      headers: { cookie: authCookies.map((c) => `${c.name}=${c.value}`).join("; ") },
      redirect: "manual",
    }).then((r) => r.text());
    const referenced = new Set();
    const re = /(?:src|href)="([^"]*_next\/static\/[^"]*\.js)"/g;
    let m;
    while ((m = re.exec(html)) !== null) referenced.add(basename(m[1]));

    let bytes = 0; const files = [];
    for (const [url, len] of wire) {
      if (referenced.has(basename(url))) { bytes += len; files.push({ f: basename(url), kb: +(len / 1024).toFixed(1) }); }
    }
    files.sort((a, b) => b.kb - a.kb);
    jsResult = {
      firstLoadKb: +(bytes / 1024).toFixed(1),
      fileCount: files.length,
      referencedInDoc: referenced.size,
      allJsOnWireKb: +([...wire.values()].reduce((a, b) => a + b, 0) / 1024).toFixed(1),
      allJsOnWireFiles: wire.size,
      topChunks: files.slice(0, 12),
    };
  }
  await ctx.close();
  return { status, finalUrl, vitals, jsResult };
}

const results = { desktop: [], mobile: [] };

console.log("\n=== 1440x900 (JS + LCP + CLS) ===");
for (let i = 0; i < 3; i++) {
  const r = await coldRun({ width: 1440, height: 900 }, true);
  results.desktop.push(r);
  console.log(`run ${i + 1}: status=${r.status} url=${r.finalUrl} react310=${r.vitals.react310} ` +
    `JS=${r.jsResult.firstLoadKb}KB/${r.jsResult.fileCount}f LCP=${r.vitals.lcp.toFixed(0)}ms ` +
    `CLS=${r.vitals.cls.toFixed(4)} (lcpE=${r.vitals.lcpEntries} clsE=${r.vitals.clsEntries} h=${r.vitals.docHeight})`);
}

console.log("\n=== 390x844 (LCP + CLS) ===");
for (let i = 0; i < 3; i++) {
  const r = await coldRun({ width: 390, height: 844 }, false);
  results.mobile.push(r);
  console.log(`run ${i + 1}: status=${r.status} url=${r.finalUrl} react310=${r.vitals.react310} ` +
    `LCP=${r.vitals.lcp.toFixed(0)}ms CLS=${r.vitals.cls.toFixed(4)} ` +
    `(lcpE=${r.vitals.lcpEntries} clsE=${r.vitals.clsEntries} h=${r.vitals.docHeight})`);
}

const summary = {
  firstLoadJsKb: median(results.desktop.map((r) => r.jsResult.firstLoadKb)),
  firstLoadFiles: median(results.desktop.map((r) => r.jsResult.fileCount)),
  lcpDesktopMs: median(results.desktop.map((r) => r.vitals.lcp)),
  clsDesktop: median(results.desktop.map((r) => r.vitals.cls)),
  lcpMobileMs: median(results.mobile.map((r) => r.vitals.lcp)),
  clsMobile: median(results.mobile.map((r) => r.vitals.cls)),
  react310Any: [...results.desktop, ...results.mobile].some((r) => r.vitals.react310),
  topChunks: results.desktop[0].jsResult.topChunks,
  allJsOnWireKb: results.desktop[0].jsResult.allJsOnWireKb,
  allJsOnWireFiles: results.desktop[0].jsResult.allJsOnWireFiles,
  referencedInDoc: results.desktop[0].jsResult.referencedInDoc,
};

console.log("\n=== MEDIANS ===");
console.log(JSON.stringify(summary, null, 2));
writeFileSync(join(OUT, "perf-run-output.json"), JSON.stringify({ summary, results }, null, 2));
console.log("\nwrote evidence-p34z/perf-run-output.json");
await browser.close();
