import { chromium } from "@playwright/test";

const BASE = "http://localhost:3601";
const EMAIL = "probe-user@example.com";
const PW = "probe-secret-123";
const CREDS = ["probe-user", "example.com", "probe-secret", "%40", "40example"]; // substrings to hunt in URLs

function urlHasCreds(u) {
  const hits = CREDS.filter((c) => u.toLowerCase().includes(c.toLowerCase()));
  return hits;
}

// Cold-load (JS disabled) submit test. `how` = "enter" | "click".
async function coldSubmit(browser, path, how, opts = {}) {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  const docRequests = [];
  page.on("request", (req) => {
    if (req.isNavigationRequest() || req.resourceType() === "document") {
      docRequests.push({ method: req.method(), url: req.url(), nav: req.isNavigationRequest() });
    }
  });

  const url = BASE + path + (opts.query || "");
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const form = page.locator("form").first();
  const formCount = await page.locator("form").count();
  if (formCount === 0) {
    await ctx.close();
    return { path, how, formRendered: false, note: "no <form> rendered", docRequests: [] };
  }

  // Fill email + password if present.
  const emailField = page.locator('input[type="email"], input[name="email"]').first();
  if (await emailField.count()) await emailField.fill(EMAIL);
  const pwField = page.locator('input[type="password"]').first();
  if (await pwField.count()) await pwField.fill(PW);

  docRequests.length = 0; // only capture what the SUBMIT triggers

  try {
    if (how === "enter") {
      // Focus a text field then press Enter -> native form submit.
      const focusTarget = (await emailField.count()) ? emailField : form.locator("input").first();
      await focusTarget.click();
      await Promise.race([
        page.waitForNavigation({ timeout: 4000 }).catch(() => {}),
        page.keyboard.press("Enter"),
      ]);
      await page.waitForTimeout(1200);
    } else {
      const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:not([type])').first();
      if (await submitBtn.count()) {
        await Promise.all([
          page.waitForNavigation({ timeout: 4000 }).catch(() => {}),
          submitBtn.click({ noWaitAfter: true }).catch(() => {}),
        ]);
      }
      await page.waitForTimeout(1200);
    }
  } catch (e) {
    // ignore, we inspect requests below
  }

  const finalUrl = page.url();
  await ctx.close();

  // Determine the submit-triggered document request (first nav after fill).
  const submitReq = docRequests.find((r) => r.nav) || docRequests[0] || null;
  const allCredHits = [];
  for (const r of docRequests) {
    const h = urlHasCreds(r.url);
    if (h.length) allCredHits.push({ url: r.url, method: r.method, hits: h });
  }
  const finalCredHits = urlHasCreds(finalUrl);

  const method = submitReq ? submitReq.method : "(no doc request captured)";
  const pass = method === "POST" && allCredHits.length === 0 && finalCredHits.length === 0;

  return {
    path,
    how,
    formRendered: true,
    finalUrl,
    submitMethod: method,
    submitUrl: submitReq ? submitReq.url : null,
    docRequests: docRequests.map((r) => `${r.method} ${r.url}`),
    credInUrls: allCredHits,
    credInFinalUrl: finalCredHits,
    verdict: pass ? "PASS" : "FAIL",
  };
}

// Hydrated real login regression.
async function hydratedLogin(browser) {
  const ctx = await browser.newContext(); // JS enabled
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.locator('input[type="email"], input[name="email"]').first().fill("claude-testing@example.com");
  await page.locator('input[type="password"]').first().fill("12345678");
  await page.locator('button[type="submit"], button:not([type])').first().click();
  // Wait for redirect away from /login
  let landed = null;
  try {
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
    landed = page.url();
  } catch {
    landed = page.url();
  }
  await page.waitForTimeout(1500);
  const finalUrl = page.url();
  // Check we look authenticated: not on /login, no visible error
  const onLogin = finalUrl.includes("/login");
  await ctx.close();
  return { finalUrl, landedAfterWait: landed, authenticated: !onLogin };
}

const browser = await chromium.launch();
const results = {};

results.login_enter = await coldSubmit(browser, "/login", "enter");
results.login_click = await coldSubmit(browser, "/login", "click");
results.register_enter = await coldSubmit(browser, "/register", "enter");
results.register_click = await coldSubmit(browser, "/register", "click");
results.forgot_enter = await coldSubmit(browser, "/forgot-password", "enter");
results.forgot_click = await coldSubmit(browser, "/forgot-password", "click");
results.reset_enter = await coldSubmit(browser, "/reset-password", "enter", { query: "?token=probe-token-123" });
results.reset_click = await coldSubmit(browser, "/reset-password", "click", { query: "?token=probe-token-123" });

results.hydrated_login = await hydratedLogin(browser);

await browser.close();
console.log(JSON.stringify(results, null, 2));
