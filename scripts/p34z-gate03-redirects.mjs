/**
 * P34-Z GATE-03 item 1: alias redirect evidence. READ-ONLY, no login needed.
 * Hits all 15 alias sources with maxRedirects:0 and records status + Location.
 * Assumes dev server already running at :3600.
 *   node scripts/p34z-gate03-redirects.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3600";
const OUT = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p34z";
mkdirSync(OUT, { recursive: true });

const PAIRS = [
  ["/chat", "/"],
  ["/coach", "/"],
  ["/water", "/hydration"],
  ["/weight", "/progress"],
  ["/body", "/progress"],
  ["/food", "/nutrition"],
  ["/meals", "/nutrition"],
  ["/calories", "/nutrition"],
  ["/workout", "/workouts"],
  ["/settings", "/account"],
  ["/billing", "/account"],
  ["/report", "/reports"],
  ["/quit", "/quit-date"],
  ["/quit-test", "/quit-date"],
  ["/dashboard", "/today"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const api = ctx.request;
const rows = [];
let pass = 0;
for (const [src, dst] of PAIRS) {
  const resp = await api.get(`${BASE}${src}`, { maxRedirects: 0 });
  const status = resp.status();
  const loc = resp.headers()["location"] || "";
  const ok = status === 307 && (loc === dst || loc.endsWith(dst));
  if (ok) pass++;
  rows.push({ src, dst, status, loc, ok });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${src} -> status=${status} location=${loc || "-"} (want 307 -> ${dst})`);
}
await ctx.close();
await browser.close();

let md = `# GATE-03 item 1: alias redirects (fresh run 2026-07-13)\n\nAgainst ${BASE}, unauthenticated, maxRedirects=0. Redirects run before the auth proxy so they respond identically signed-out.\n\n**${pass}/${PAIRS.length} PASS**\n\n| Source | Status | Location | Expected | Result |\n|---|---|---|---|---|\n`;
for (const r of rows) md += `| ${r.src} | ${r.status} | ${r.loc || "-"} | 307 -> ${r.dst} | ${r.ok ? "PASS" : "FAIL"} |\n`;
writeFileSync(`${OUT}/redirects-fresh.md`, md);
console.log(`\n=== ${pass}/${PAIRS.length} PASS ===\nwrote ${OUT}/redirects-fresh.md`);
