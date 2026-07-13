// P34-A browser smoke: FIX-21 bottom nav + FIX-20 grouped desktop nav.
// Read-only against the SHARED PROD DB. Navigation / focus / screenshots only.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "evidence-p34a", "ours");
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3600";
const EMAIL = "claude-testing@example.com";
const PASSWORD = "12345678";

const results = [];
const rec = (id, pass, detail) => {
  results.push({ id, pass, detail });
  const tag = pass === true ? "PASS" : pass === false ? "FAIL" : "NOTE";
  console.log(`[${tag}] ${id} :: ${detail}`);
};

const shot = async (page, name) => {
  await page.screenshot({ path: join(OUT, name), fullPage: false });
  console.log(`  shot ${name}`);
};

// force theme via next-themes localStorage key "theme" (attribute=class)
async function setTheme(context, theme) {
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }, theme);
}

const navSel = 'nav[aria-label="Primary"]';

async function measure(page, selector) {
  return page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  });
}

async function tabInfo(page) {
  return page.$eval(navSel, (nav) => {
    const row = nav.querySelector("div");
    const kids = Array.from(row.children);
    return kids.map((el) => {
      const r = el.getBoundingClientRect();
      const label = el.querySelector("span:last-child")?.textContent?.trim() || el.textContent.trim();
      return {
        label,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        ariaCurrent: el.getAttribute("aria-current"),
        tag: el.tagName.toLowerCase(),
      };
    });
  });
}

(async () => {
  const browser = await chromium.launch();

  // ---- login in a plain context, save storage ----
  const loginCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const lp = await loginCtx.newPage();
  await lp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await lp.waitForTimeout(1200); // let hydration settle so controlled inputs stick
  // Robust fill: RHF-controlled inputs can be reset by a late hydration/HMR
  // pass, so fill then verify and retry until the DOM value sticks.
  const robustFill = async (sel, val) => {
    for (let i = 0; i < 5; i++) {
      await lp.fill(sel, val);
      await lp.waitForTimeout(200);
      if ((await lp.inputValue(sel)) === val) return true;
    }
    return (await lp.inputValue(sel)) === val;
  };
  const eOk = await robustFill('input[type="email"]', EMAIL);
  const pOk = await robustFill('input[type="password"]', PASSWORD);
  console.log(`  filled email=${eOk} password=${pOk}`);
  // The credentials submit is the button labelled exactly "Sign in" — NOT the
  // "Continue with Google" submit (which lives in its own form above).
  await lp.getByRole("button", { name: "Sign in", exact: true }).click();
  await lp.waitForTimeout(3500);
  // Verify by loading a gated page: authed => stays on /today, else bounced to /login.
  await lp.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
  await lp.waitForTimeout(800);
  const authed = new URL(lp.url()).pathname === "/today";
  rec("login", authed, `after login, /today resolved to ${new URL(lp.url()).pathname}`);
  if (!authed) {
    console.error("Login failed — aborting.");
    await browser.close();
    process.exit(1);
  }
  const storageState = await loginCtx.storageState();
  await loginCtx.close();

  // helper to make a fresh authed context
  const mkCtx = async (opts) => {
    const ctx = await browser.newContext({ storageState, ...opts });
    if (opts.__theme) await setTheme(ctx, opts.__theme);
    return ctx;
  };

  const phone = (w, h, theme) => ({
    viewport: { width: w, height: h },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    __theme: theme,
  });

  // ================= STEP 1: /today phone matrix =================
  for (const [w, h, theme] of [
    [390, 844, "dark"],
    [390, 844, "light"],
    [360, 800, "dark"],
    [320, 568, "dark"],
  ]) {
    const ctx = await browser.newContext({ storageState, viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await setTheme(ctx, theme);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    // The bar is client-mounted (useEffect); wait for it before asserting.
    await page.waitForSelector(navSel, { state: "visible", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    const key = `today-${w}-${theme}`;
    await shot(page, `01-${key}.png`);

    const barVisible = await page.isVisible(navSel).catch(() => false);
    rec(`${key}/bar-visible`, barVisible, `nav[aria-label=Primary] visible=${barVisible}`);

    if (barVisible) {
      const bar = await measure(page, navSel);
      // inner h-14 row height (h-14 = 56px; tolerate line-box rounding 52-64)
      const rowH = await page.$eval(navSel, (n) => n.querySelector("div").getBoundingClientRect().height);
      rec(`${key}/bar-height`, rowH >= 52 && rowH <= 64, `inner row height=${Math.round(rowH)}px (want ~56, tolerance 52-64)`);

      const tabs = await tabInfo(page);
      const labels = tabs.map((t) => t.label);
      const want = ["Today", "Log", "Progress", "Coach", "More"];
      rec(`${key}/tab-count`, tabs.length === 5, `count=${tabs.length}`);
      rec(`${key}/tab-labels`, JSON.stringify(labels) === JSON.stringify(want), `labels=${JSON.stringify(labels)}`);

      const active = tabs.filter((t) => t.ariaCurrent === "page").map((t) => t.label);
      rec(`${key}/today-active`, active.length === 1 && active[0] === "Today", `aria-current=page on ${JSON.stringify(active)}`);

      const tooSmall = tabs.filter((t) => t.w < 44 || t.h < 44);
      rec(`${key}/tap-targets`, tooSmall.length === 0, `sizes=${tabs.map((t) => `${t.label}:${t.w}x${t.h}`).join(", ")}`);

      // horizontal overflow at document level
      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      rec(`${key}/no-h-overflow`, overflow.scrollW <= overflow.clientW + 1, `scrollW=${overflow.scrollW} clientW=${overflow.clientW}`);
    }
    await ctx.close();
  }

  // ================= STEP 2: /progress 390 dark — Progress active =================
  {
    const ctx = await browser.newContext({ storageState, ...phone(390, 844) });
    await setTheme(ctx, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/progress`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const tabs = await tabInfo(page);
    const active = tabs.filter((t) => t.ariaCurrent === "page").map((t) => t.label);
    rec("progress-390/active", active.length === 1 && active[0] === "Progress", `aria-current=page on ${JSON.stringify(active)}`);
    await shot(page, `02-progress-390-dark.png`);
    await ctx.close();
  }

  // ================= STEP 3: / (chat) 390 dark — Coach active + composer above bar =================
  {
    const ctx = await browser.newContext({ storageState, ...phone(390, 844) });
    await setTheme(ctx, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const barVisible = await page.isVisible(navSel).catch(() => false);
    rec("chat-390/bar-visible", barVisible, `visible=${barVisible}`);
    const tabs = await tabInfo(page);
    const active = tabs.filter((t) => t.ariaCurrent === "page").map((t) => t.label);
    rec("chat-390/coach-active", active.length === 1 && active[0] === "Coach", `aria-current=page on ${JSON.stringify(active)}`);

    // composer bottom edge <= bar top edge
    const hasComposer = await page.$('[data-testid="multimodal-input"]');
    if (hasComposer && barVisible) {
      const bar = await measure(page, navSel);
      const composerBottom = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="multimodal-input"]');
        const send = document.querySelector('[data-testid="send-button"]');
        let b = el.getBoundingClientRect().bottom;
        if (send) b = Math.max(b, send.getBoundingClientRect().bottom);
        return b;
      });
      rec("chat-390/composer-above-bar", composerBottom <= bar.top + 1, `composerBottom=${Math.round(composerBottom)} barTop=${Math.round(bar.top)}`);
    } else {
      rec("chat-390/composer-above-bar", null, `composer present=${!!hasComposer} bar=${barVisible}`);
    }
    await shot(page, `03-chat-390-dark.png`);
    await ctx.close();
  }

  // ================= STEP 4: Log drawer on /today 390 (dark + light) =================
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({ storageState, ...phone(390, 844) });
    await setTheme(ctx, theme);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    // tap Log (the button with the plus, 2nd tab)
    await page.getByRole("button", { name: "Log", exact: true }).click().catch(async () => {
      // fallback: click 2nd child
      await page.$eval(navSel, (n) => n.querySelector("div").children[1].click());
    });
    await page.waitForTimeout(500);
    const drawerOpen = await page.getByText("What do you want to log?").isVisible().catch(() => false);
    rec(`log-drawer-${theme}/open`, drawerOpen, `title visible=${drawerOpen}`);

    if (drawerOpen) {
      const rows = await page.evaluate(() => {
        // Scope to the open drawer dialog so we don't match a same-labelled
        // link on the /today page rendered behind the overlay.
        const scope = document.querySelector('[data-slot="drawer-content"], [role="dialog"]') || document;
        const wants = ["Log a meal", "Log water", "Log sleep", "Log a weigh-in", "Log a workout"];
        return wants.map((label) => {
          const a = Array.from(scope.querySelectorAll("a")).find((x) => x.textContent.trim() === label);
          if (!a) return { label, found: false };
          const r = a.getBoundingClientRect();
          return { label, found: true, w: Math.round(r.width), h: Math.round(r.height) };
        });
      });
      const allFound = rows.every((r) => r.found);
      rec(`log-drawer-${theme}/rows`, allFound, `rows=${rows.map((r) => r.found ? `${r.label}(${r.w}x${r.h})` : `${r.label}:MISSING`).join(", ")}`);
      const badTarget = rows.filter((r) => r.found && r.h < 44);
      rec(`log-drawer-${theme}/tap-targets`, badTarget.length === 0, `min heights ok, bad=${badTarget.map((r) => r.label).join(",") || "none"}`);

      const activeIsInput = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName.toLowerCase() + (el.getAttribute("type") ? `[${el.getAttribute("type")}]` : "") : "none";
      });
      const notInput = !/^(input|textarea|select)/.test(activeIsInput);
      rec(`log-drawer-${theme}/no-autofocus`, notInput, `activeElement=${activeIsInput}`);
    }
    await shot(page, `04-log-drawer-390-${theme}.png`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await ctx.close();
  }

  // ================= STEP 5: More drawer on /today 390 dark =================
  {
    const ctx = await browser.newContext({ storageState, ...phone(390, 844) });
    await setTheme(ctx, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "More", exact: true }).click().catch(async () => {
      await page.$eval(navSel, (n) => n.querySelector("div").children[4].click());
    });
    await page.waitForTimeout(500);
    const headings = await page.evaluate(() => {
      const wants = ["Track", "Plan", "Review", "More"];
      return wants.map((t) => ({ t, present: Array.from(document.querySelectorAll("p")).some((p) => p.textContent.trim() === t) }));
    });
    const allHeadings = headings.every((h) => h.present);
    rec("more-drawer/headings", allHeadings, `${headings.map((h) => `${h.t}:${h.present}`).join(", ")}`);
    await shot(page, `05-more-drawer-390-dark.png`);

    // tap Hydration -> /hydration + drawer closes. Scope to the open dialog.
    const dialog = page.locator('[data-slot="drawer-content"], [role="dialog"]').first();
    const hyd = dialog.getByRole("link", { name: "Hydration", exact: true });
    await hyd.scrollIntoViewIfNeeded().catch(() => {});
    await Promise.all([
      page.waitForURL((u) => u.pathname === "/hydration", { timeout: 6000 }).catch(() => {}),
      hyd.click().catch(() => {}),
    ]);
    await page.waitForTimeout(600);
    const onHydration = new URL(page.url()).pathname === "/hydration";
    rec("more-drawer/hydration-nav", onHydration, `url=${new URL(page.url()).pathname}`);
    const drawerVisible = await page.locator('[data-slot="drawer-content"], [role="dialog"]').first().isVisible().catch(() => false);
    rec("more-drawer/closes", onHydration && !drawerVisible, `navigated=${onHydration}, drawer still visible=${drawerVisible}`);
    await ctx.close();
  }

  // ================= STEP 6: KEYBOARD PROBE =================
  // 6a chat composer
  {
    const ctx = await browser.newContext({ storageState, ...phone(390, 844) });
    await setTheme(ctx, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.$eval('[data-testid="multimodal-input"]', (el) => el.focus());
    await page.waitForTimeout(300);
    const vkOpen = await page.evaluate(() => document.documentElement.hasAttribute("data-vk-open"));
    rec("kbd-chat/vk-open", vkOpen, `html[data-vk-open]=${vkOpen}`);
    const barState = await page.evaluate((sel) => {
      const n = document.querySelector(sel);
      const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      return { top: Math.round(r.top), vh: window.innerHeight, transform: cs.transform, hasClass: n.className.includes("translate-y-full") };
    }, navSel);
    const offscreen = barState.top >= barState.vh - 1 || barState.hasClass;
    rec("kbd-chat/bar-hidden", offscreen, `barTop=${barState.top} vh=${barState.vh} translateClass=${barState.hasClass} transform=${barState.transform}`);
    await shot(page, `06-keyboard-hidden-390.png`);
    // blur -> returns
    await page.$eval('[data-testid="multimodal-input"]', (el) => el.blur());
    await page.waitForTimeout(400);
    const vkClosed = await page.evaluate(() => !document.documentElement.hasAttribute("data-vk-open"));
    rec("kbd-chat/vk-removed-on-blur", vkClosed, `data-vk-open removed=${vkClosed}`);
    await ctx.close();
  }
  // 6b standalone /nutrition input
  {
    const ctx = await browser.newContext({ storageState, ...phone(390, 844) });
    await setTheme(ctx, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/nutrition`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const inputCount = await page.evaluate(() => document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]), textarea').length);
    if (inputCount > 0) {
      await page.evaluate(() => {
        const el = document.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]), textarea');
        el.focus();
      });
      await page.waitForTimeout(300);
      const vkOpen = await page.evaluate(() => document.documentElement.hasAttribute("data-vk-open"));
      rec("kbd-nutrition/vk-open", vkOpen, `html[data-vk-open]=${vkOpen} (inputs=${inputCount})`);
      const offscreen = await page.evaluate((sel) => {
        const n = document.querySelector(sel);
        if (!n) return { ok: false, note: "no bar" };
        const r = n.getBoundingClientRect();
        return { ok: r.top >= window.innerHeight - 1 || n.className.includes("translate-y-full"), top: Math.round(r.top), vh: window.innerHeight };
      }, navSel);
      rec("kbd-nutrition/bar-hidden", offscreen.ok, `barTop=${offscreen.top} vh=${offscreen.vh}`);
    } else {
      rec("kbd-nutrition/vk-open", null, `no editable input found on /nutrition (inputs=${inputCount})`);
    }
    await ctx.close();
  }

  // ================= STEP 7: Desktop 1440 =================
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
    await setTheme(ctx, theme);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const barVisible = await page.isVisible(navSel).catch(() => false);
    rec(`desktop-${theme}/no-bottom-bar`, !barVisible, `bottom nav visible=${barVisible} (want false)`);
    const groups = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('[data-slot="sidebar"] [data-sidebar="group-label"], [data-sidebar="group-label"]')).map((e) => e.textContent.trim());
      return labels;
    });
    const want = ["Track", "Plan", "Review", "More"];
    const hasGroups = want.every((g) => groups.includes(g));
    rec(`desktop-${theme}/sidebar-groups`, hasGroups, `group labels=${JSON.stringify(groups)}`);
    await shot(page, `07-sidebar-1440-${theme}.png`);
    await ctx.close();
  }
  // 7b active state on /workouts/history
  {
    const ctx = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
    await setTheme(ctx, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/workouts/history`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const workoutsActive = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const wl = links.find((a) => a.textContent.trim() === "Workouts" && a.closest('[data-sidebar="menu-button"]'));
      const btn = wl ? wl.closest('[data-sidebar="menu-button"]') : null;
      return {
        found: !!btn,
        dataActive: btn ? btn.getAttribute("data-active") : null,
        ariaCurrent: btn ? btn.getAttribute("aria-current") : null,
      };
    });
    rec("desktop/workouts-active", workoutsActive.dataActive === "true" || workoutsActive.ariaCurrent === "page", `data-active=${workoutsActive.dataActive} aria-current=${workoutsActive.ariaCurrent} found=${workoutsActive.found}`);
    await shot(page, `07b-sidebar-active-workouts-1440.png`);
    await ctx.close();
  }

  // ================= STEP 8: phone hamburger sheet on /today 390 =================
  {
    const ctx = await browser.newContext({ storageState, ...phone(390, 844) });
    await setTheme(ctx, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(500);
    const headings = await page.evaluate(() => {
      const wants = ["Track", "Plan", "Review", "More"];
      return wants.map((t) => ({ t, present: Array.from(document.querySelectorAll("p")).some((p) => p.textContent.trim() === t) }));
    });
    const ok = headings.every((h) => h.present);
    rec("sheet/headings", ok, `${headings.map((h) => `${h.t}:${h.present}`).join(", ")}`);
    await shot(page, `08-sheet-390-dark.png`);
    await ctx.close();
  }

  // ================= STEP 9: redirects (no follow) =================
  {
    const ctx = await browser.newContext();
    const api = ctx.request;
    const pairs = [
      ["/water", "/hydration"],
      ["/weight", "/progress"],
      ["/settings", "/account"],
      ["/chat", "/"],
      ["/quit-test", "/quit-date"],
      ["/meals", "/nutrition"],
      ["/dashboard", "/today"],
    ];
    for (const [src, dst] of pairs) {
      const resp = await api.get(`${BASE}${src}`, { maxRedirects: 0 }).catch((e) => ({ status: () => -1, headers: () => ({}), _err: String(e) }));
      const status = resp.status();
      const loc = resp.headers()["location"] || "";
      const ok = (status === 307 || status === 308) && (loc === dst || loc.endsWith(dst));
      rec(`redirect ${src}`, ok, `status=${status} location=${loc} (want 307/308 -> ${dst})`);
    }
    await ctx.close();
  }

  // ================= STEP 10: safe-area code-level check =================
  {
    const ctx = await browser.newContext({ storageState, ...phone(390, 844) });
    await setTheme(ctx, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const hasClass = await page.$eval(navSel, (n) => n.className.includes("pb-safe-edge"));
    const padBottom = await page.$eval(navSel, (n) => getComputedStyle(n).paddingBottom);
    rec("safe-area/class-present", hasClass, `pb-safe-edge class on bar=${hasClass}; computed padding-bottom=${padBottom} (env() resolves 0 without real insets — code-level check)`);
    await ctx.close();
  }

  await browser.close();

  // ---- write findings ----
  const pass = results.filter((r) => r.pass === true).length;
  const fail = results.filter((r) => r.pass === false).length;
  const note = results.filter((r) => r.pass === null).length;
  let md = `# P34-A smoke findings\n\nGenerated ${new Date().toISOString()} against ${BASE} (shared prod DB, read-only).\n\n`;
  md += `**Totals: ${pass} PASS / ${fail} FAIL / ${note} NOTE**\n\n`;
  md += `| # | Assertion | Result | Detail |\n|---|---|---|---|\n`;
  results.forEach((r, i) => {
    const tag = r.pass === true ? "PASS" : r.pass === false ? "FAIL" : "NOTE";
    md += `| ${i + 1} | ${r.id} | ${tag} | ${r.detail.replace(/\|/g, "\\|")} |\n`;
  });
  writeFileSync(join(OUT, "smoke-findings.md"), md);
  console.log(`\n=== ${pass} PASS / ${fail} FAIL / ${note} NOTE ===`);
  console.log(`findings -> ${join(OUT, "smoke-findings.md")}`);
  process.exit(0);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
