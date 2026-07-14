// Shared auth + helpers for the P56-C pre-delivery audit (read-only toward code).
import { chromium } from "@playwright/test";
import { encode, decode } from "next-auth/jwt";
import { readFileSync } from "node:fs";

export const BASE = "http://localhost:3600";
const EMAIL = "claude-testing@example.com";
const PASSWORD = "12345678";
const NONSECURE = "authjs.session-token";
const SECURE = "__Secure-authjs.session-token";
export const OUT = "C:/Users/jon17/Desktop/chadchat/evidence-p56c/audit";

function readSecret() {
  const env = readFileSync("C:/Users/jon17/Desktop/chadchat/.env.local", "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("AUTH_SECRET="));
  const secret = line?.slice("AUTH_SECRET=".length).trim().replace(/^["']|["']$/g, "");
  if (!secret) throw new Error("AUTH_SECRET not found");
  return secret;
}

export async function makeBrowser() {
  const browser = await chromium.launch();
  const secret = readSecret();
  const loginCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const lp = await loginCtx.newPage();
  await lp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await lp.waitForTimeout(1000);
  const robustFill = async (sel, val) => {
    for (let i = 0; i < 6; i++) {
      await lp.fill(sel, val);
      await lp.waitForTimeout(120);
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
  if (!nonSecure) throw new Error("login failed: " + cookies.map((c) => c.name).join(","));
  const payload = await decode({ token: nonSecure.value, secret, salt: NONSECURE });
  const secureJwt = await encode({ token: payload, secret, salt: SECURE, maxAge: 30 * 24 * 60 * 60 });
  const authCookies = [
    { name: NONSECURE, value: nonSecure.value, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
    { name: SECURE, value: secureJwt, domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
  ];
  await loginCtx.close();
  console.log("auth ready for", payload.email ?? payload.id);
  return { browser, authCookies };
}

export async function ctxFor(browser, authCookies, viewport, theme, opts = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme: theme, bypassCSP: true, ...opts });
  await ctx.addCookies(authCookies);
  return ctx;
}
