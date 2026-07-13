// P34-A FINAL verification: FIX-21 bottom nav + FIX-20 grouped nav, after the
// uncaptioned-utility refinement (no "More" caption; trailing block with a
// hairline top border on every surface).
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

const navSel = 'nav[aria-label="Primary"]';

async function tabInfo(page) {
  return page.$eval(navSel, (nav) => {
    const row = nav.querySelector("div");
    return Array.from(row.children).map((el) => {
      const r = el.getBoundingClientRect();
      const label = el.querySelector("span:last-child")?.textContent?.trim() || el.textContent.trim();
      return { label, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, ariaCurrent: el.getAttribute("aria-current") };
    });
  });
}

// Shared assertion: captions Track/Plan/Review present, NO "More" group
// caption, and the block containing "Rate My Kitchen" has a top hairline.
// `scopeSel` narrows the query to the surface (drawer/sheet/sidebar).
async function utilityBlockCheck(page, scopeSel) {
  return page.evaluate((sel) => {
    const scope = sel ? document.querySelector(sel) : document;
    if (!scope) return { error: `scope ${sel} not found` };
    const texts = (q) => Array.from(scope.querySelectorAll(q)).map((e) => e.textContent.trim());
    // group captions render as <p> (drawer/sheet) or [data-sidebar=group-label]
    const captions = [
      ...texts("p"),
      ...texts('[data-sidebar="group-label"]'),
    ].filter((t) => ["Track", "Plan", "Review", "More"].includes(t));
    const links = Array.from(scope.querySelectorAll("a"));
    const rmk = links.find((a) => a.textContent.trim() === "Rate My Kitchen");
    if (!rmk) return { captions, rmk: false };
    // walk up to the utility container and look for a border-top >= 1px on it
    // or on a divider element vertically between Weekly Report and RMK.
    let node = rmk;
    let borderTop = 0;
    for (let i = 0; i < 5 && node && node !== scope; i++) {
      const bt = parseFloat(getComputedStyle(node).borderTopWidth) || 0;
      if (bt >= 0.5) { borderTop = bt; break; }
      node = node.parentElement;
    }
    if (borderTop < 0.5) {
      // sheet variant: a standalone divider div between the review links and RMK
      const wr = links.find((a) => a.textContent.trim() === "Weekly Report");
      if (wr) {
        const wrB = wr.getBoundingClientRect().bottom;
        const rmkT = rmk.getBoundingClientRect().top;
        const divider = Array.from(scope.querySelectorAll("div, hr")).find((d) => {
          const cs = getComputedStyle(d);
          const bt = parseFloat(cs.borderTopWidth) || 0;
          if (bt < 0.5) return false;
          const r = d.getBoundingClientRect();
          return r.top >= wrB - 2 && r.top <= rmkT + 2 && r.height < 20;
        });
        if (divider) borderTop = parseFloat(getComputedStyle(divider).borderTopWidth);
      }
    }
    const utilLinks = ["Rate My Kitchen", "Files", "Quit Test", "Account", "Help"].map((l) => ({
      l,
      present: links.some((a) => a.textContent.trim() === l),
    }));
    return { captions, rmk: true, borderTop, utilLinks };
  }, scopeSel);
}

function reportUtility(id, r) {
  if (r.error || !r.rmk) {
    rec(`${id}/utility-block`, false, r.error || "Rate My Kitchen link not found");
    return;
  }
  const hasTPR = ["Track", "Plan", "Review"].every((c) => r.captions.includes(c));
  const noMore = !r.captions.includes("More");
  rec(`${id}/captions`, hasTPR && noMore, `captions=${JSON.stringify(r.captions)} (want Track/Plan/Review, NO More)`);
  rec(`${id}/separator`, r.borderTop >= 0.5, `hairline top border=${r.borderTop}px above utility block`);
  const missing = r.utilLinks.filter((u) => !u.present).map((u) => u.l);
  rec(`${id}/utility-links`, missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : "Rate My Kitchen/Files/Quit Test/Account/Help all present");
}

(async () => {
  const browser = await chromium.launch();

  // ---- login ----
  const loginCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const lp = await loginCtx.newPage();
  await lp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await lp.waitForTimeout(1200);
  const robustFill = async (sel, val) => {
    for (let i = 0; i < 5; i++) {
      await lp.fill(sel, val);
      await lp.waitForTimeout(200);
      if ((await lp.inputValue(sel)) === val) return true;
    }
    return false;
  };
  await robustFill('input[type="email"]', EMAIL);
  await robustFill('input[type="password"]', PASSWORD);
  await lp.getByRole("button", { name: "Sign in", exact: true }).click();
  await lp.waitForTimeout(3500);
  await lp.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
  await lp.waitForTimeout(800);
  const authed = new URL(lp.url()).pathname === "/today";
  rec("login", authed, `/today resolved to ${new URL(lp.url()).pathname}`);
  if (!authed) { await browser.close(); process.exit(1); }
  const storageState = await loginCtx.storageState();
  await loginCtx.close();

  const mkPhone = async (w, h, theme) => {
    const ctx = await browser.newContext({ storageState, viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
    return ctx;
  };
  const mkDesk = async (w, h, theme) => {
    const ctx = await browser.newContext({ storageState, viewport: { width: w, height: h } });
    await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
    return ctx;
  };

  // ============ 1. /today bottom bar, 3 widths x 2 themes ============
  for (const [w, h] of [[390, 844], [360, 800], [320, 568]]) {
    for (const theme of ["dark", "light"]) {
      const ctx = await mkPhone(w, h, theme);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
      await page.waitForSelector(navSel, { state: "visible", timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      const key = `today-${w}-${theme}`;
      await shot(page, `final-${key}.png`);
      const visible = await page.isVisible(navSel).catch(() => false);
      rec(`${key}/bar-visible`, visible, `visible=${visible}`);
      if (visible) {
        const tabs = await tabInfo(page);
        const want = ["Today", "Log", "Progress", "Coach", "More"];
        rec(`${key}/labels`, JSON.stringify(tabs.map((t) => t.label)) === JSON.stringify(want), `labels=${JSON.stringify(tabs.map((t) => t.label))}`);
        const small = tabs.filter((t) => t.w < 44 || t.h < 44);
        rec(`${key}/tap-targets`, small.length === 0, tabs.map((t) => `${t.label}:${t.w}x${t.h}`).join(", "));
        const ov = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
        rec(`${key}/no-overflow`, ov.s <= ov.c + 1, `scrollW=${ov.s} clientW=${ov.c}`);
        // label truncation check: no tab label ellipsized
        const truncated = await page.$eval(navSel, (n) =>
          Array.from(n.querySelectorAll("span.truncate")).filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent.trim())
        );
        rec(`${key}/labels-intact`, truncated.length === 0, truncated.length ? `truncated: ${truncated.join(",")}` : "no label truncation");
      }
      await ctx.close();
    }
  }

  // ============ 2. More drawer 390 dark + light: uncaptioned utility ============
  for (const theme of ["dark", "light"]) {
    const ctx = await mkPhone(390, 844, theme);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForSelector(navSel, { state: "visible", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.waitForTimeout(500);
    const r = await utilityBlockCheck(page, '[data-slot="drawer-content"]');
    reportUtility(`more-drawer-${theme}`, r);
    // scroll drawer content so the utility block is in the shot
    await page.evaluate(() => {
      const sc = document.querySelector('[data-slot="drawer-content"] .overflow-y-auto') ||
                 document.querySelector('[data-slot="drawer-content"] > div:last-child');
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await page.waitForTimeout(300);
    await shot(page, `final-more-drawer-390-${theme}.png`);
    await ctx.close();
  }

  // ============ 3. Hamburger sheet 390 dark ============
  {
    const ctx = await mkPhone(390, 844, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(700); // stagger animation
    const r = await utilityBlockCheck(page, '[data-slot="sheet-content"], [role="dialog"]');
    reportUtility("sheet-390-dark", r);
    // scroll sheet list so the utility block shows
    await page.evaluate(() => {
      const sc = document.querySelector('[role="dialog"] .overflow-y-auto');
      if (sc) sc.scrollTop = sc.scrollHeight / 2;
    });
    await page.waitForTimeout(300);
    await shot(page, `final-sheet-390-dark.png`);
    await ctx.close();
  }

  // ============ 4. Desktop 1440 dark + light, tablet 768 ============
  for (const theme of ["dark", "light"]) {
    const ctx = await mkDesk(1440, 900, theme);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const barVisible = await page.isVisible(navSel).catch(() => false);
    rec(`desktop-1440-${theme}/no-bottom-bar`, !barVisible, `bottom bar visible=${barVisible} (want false)`);
    const r = await utilityBlockCheck(page, '[data-slot="sidebar"], [data-sidebar="sidebar"]');
    reportUtility(`sidebar-1440-${theme}`, r);
    await shot(page, `final-sidebar-1440-${theme}.png`);
    await ctx.close();
  }
  {
    const ctx = await mkDesk(768, 1024, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const barVisible = await page.isVisible(navSel).catch(() => false);
    rec("tablet-768/no-bottom-bar", !barVisible, `bottom bar visible at exactly 768px=${barVisible} (want false; md: breakpoint)`);
    await shot(page, `final-tablet-768-dark.png`);
    await ctx.close();
  }

  // ============ 5. Keyboard probe ============
  {
    const ctx = await mkPhone(390, 844, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await page.$eval('[data-testid="multimodal-input"]', (el) => el.focus());
    await page.waitForTimeout(300);
    const vkOpen = await page.evaluate(() => document.documentElement.hasAttribute("data-vk-open"));
    rec("kbd-chat/vk-open", vkOpen, `html[data-vk-open]=${vkOpen}`);
    const bar = await page.evaluate((sel) => {
      const n = document.querySelector(sel);
      const r = n.getBoundingClientRect();
      return { top: Math.round(r.top), vh: window.innerHeight, cls: n.className.includes("translate-y-full") };
    }, navSel);
    rec("kbd-chat/bar-offscreen", bar.top >= bar.vh - 1 || bar.cls, `barTop=${bar.top} vh=${bar.vh} translate-y-full=${bar.cls}`);
    await shot(page, `final-keyboard-hidden-390.png`);
    await page.$eval('[data-testid="multimodal-input"]', (el) => el.blur());
    await page.waitForTimeout(400);
    const restored = await page.evaluate((sel) => {
      const ok = !document.documentElement.hasAttribute("data-vk-open");
      const n = document.querySelector(sel);
      return { ok, cls: n.className.includes("translate-y-full") };
    }, navSel);
    rec("kbd-chat/restored-on-blur", restored.ok && !restored.cls, `data-vk-open removed=${restored.ok}, translate class gone=${!restored.cls}`);
    await ctx.close();
  }
  {
    const ctx = await mkPhone(390, 844, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/nutrition`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const focused = await page.evaluate(() => {
      const el = document.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]), textarea');
      if (!el) return false;
      el.focus();
      return true;
    });
    if (focused) {
      await page.waitForTimeout(300);
      const vkOpen = await page.evaluate(() => document.documentElement.hasAttribute("data-vk-open"));
      const bar = await page.evaluate((sel) => {
        const n = document.querySelector(sel);
        const r = n.getBoundingClientRect();
        return { top: Math.round(r.top), vh: window.innerHeight };
      }, navSel);
      rec("kbd-nutrition/vk-open+offscreen", vkOpen && bar.top >= bar.vh - 1, `data-vk-open=${vkOpen} barTop=${bar.top} vh=${bar.vh}`);
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(400);
      const restored = await page.evaluate(() => !document.documentElement.hasAttribute("data-vk-open"));
      rec("kbd-nutrition/restored", restored, `data-vk-open removed=${restored}`);
    } else {
      rec("kbd-nutrition/vk-open+offscreen", null, "no editable input found on /nutrition");
    }
    await ctx.close();
  }

  // ============ 6. Log drawer: rows + REAL link targets ============
  {
    const ctx = await mkPhone(390, 844, "dark");
    const page = await ctx.newPage();
    const openLogDrawer = async () => {
      await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
      await page.waitForSelector(navSel, { state: "visible", timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Log", exact: true }).click();
      await page.waitForTimeout(500);
    };
    await openLogDrawer();
    const rows = await page.evaluate(() => {
      const scope = document.querySelector('[data-slot="drawer-content"]') || document;
      const wants = ["Log a meal", "Log water", "Log sleep", "Log a weigh-in", "Log a workout"];
      return wants.map((label) => {
        const a = Array.from(scope.querySelectorAll("a")).find((x) => x.textContent.trim() === label);
        if (!a) return { label, found: false };
        const r = a.getBoundingClientRect();
        return { label, found: true, h: Math.round(r.height), href: a.getAttribute("href") };
      });
    });
    rec("log-drawer/rows", rows.every((r) => r.found), rows.map((r) => r.found ? `${r.label}(h=${r.h}, ${r.href})` : `${r.label}:MISSING`).join("; "));
    rec("log-drawer/tap-targets", rows.every((r) => r.found && r.h >= 44), `heights=${rows.map((r) => r.h).join(",")}`);
    const activeEl = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName.toLowerCase() : "none";
    });
    rec("log-drawer/no-autofocus", !/^(input|textarea|select)$/.test(activeEl), `activeElement=${activeEl}`);
    await shot(page, `final-log-drawer-390-dark.png`);

    // Anchor pages stream (Cache Components): wait for the URL, then poll for
    // the anchor element for a few seconds before judging.
    const clickAndLand = async (linkName, path) => {
      await page.locator('[data-slot="drawer-content"]').getByRole("link", { name: linkName }).click();
      await page.waitForURL((u) => u.pathname === path, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      return new URL(page.url());
    };
    const pollAnchor = async (id) => {
      for (let i = 0; i < 10; i++) {
        const r = await page.evaluate((anchorId) => {
          const el = document.getElementById(anchorId);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { top: Math.round(rect.top), inView: rect.top >= -rect.height && rect.top < window.innerHeight };
        }, id);
        if (r) return { exists: true, ...r };
        await page.waitForTimeout(500);
      }
      return { exists: false };
    };

    // 6a: tap "Log a meal" -> /nutrition#log-meal, anchor section visible
    let u = await clickAndLand("Log a meal", "/nutrition");
    const mealAnchor = await pollAnchor("log-meal");
    rec("log-meal/target", u.pathname === "/nutrition" && u.hash === "#log-meal" && mealAnchor.exists,
      `landed ${u.pathname}${u.hash}; #log-meal exists=${mealAnchor.exists} top=${mealAnchor.top} inView=${mealAnchor.inView}`);

    // 6b: "Log a weigh-in" -> /progress#log-entry
    await openLogDrawer();
    u = await clickAndLand("Log a weigh-in", "/progress");
    const weighAnchor = await pollAnchor("log-entry");
    rec("log-weigh-in/target", u.pathname === "/progress" && u.hash === "#log-entry" && weighAnchor.exists,
      `landed ${u.pathname}${u.hash}; #log-entry exists=${weighAnchor.exists} top=${weighAnchor.top} inView=${weighAnchor.inView}`);

    // 6c: "Log a workout" -> /workouts/new (navigate only, no interaction)
    await openLogDrawer();
    u = await clickAndLand("Log a workout", "/workouts/new");
    rec("log-workout/target", u.pathname === "/workouts/new", `landed ${u.pathname}`);
    await ctx.close();
  }

  // ============ 7. Redirects (full set) ============
  {
    const ctx = await browser.newContext();
    const api = ctx.request;
    const pairs = [
      ["/dashboard", "/today"], ["/chat", "/"], ["/coach", "/"],
      ["/water", "/hydration"], ["/weight", "/progress"], ["/body", "/progress"],
      ["/food", "/nutrition"], ["/meals", "/nutrition"], ["/calories", "/nutrition"],
      ["/workout", "/workouts"], ["/settings", "/account"], ["/billing", "/account"],
      ["/report", "/reports"], ["/quit", "/quit-date"], ["/quit-test", "/quit-date"],
    ];
    for (const [src, dst] of pairs) {
      const resp = await api.get(`${BASE}${src}`, { maxRedirects: 0 });
      const status = resp.status();
      const loc = resp.headers()["location"] || "";
      const ok = (status === 307 || status === 308) && (loc === dst || loc.endsWith(dst));
      rec(`redirect ${src}`, ok, `status=${status} location=${loc || "-"} (want 307/308 -> ${dst})`);
    }
    // /chat/some-fake-id must NOT 307 to /
    const resp = await api.get(`${BASE}/chat/some-fake-id`, { maxRedirects: 0 });
    const status = resp.status();
    const loc = resp.headers()["location"] || "";
    const not307ToRoot = !((status === 307 || status === 308) && (loc === "/" || loc === `${BASE}/`));
    rec("no-redirect /chat/some-fake-id", not307ToRoot, `status=${status} location=${loc || "-"} (must not be 307/308 -> /)`);
    await ctx.close();
  }

  // ============ 8. Chat 390: composer above bar, Coach active ============
  {
    const ctx = await mkPhone(390, 844, "dark");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector(navSel, { state: "visible", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    const barVisible = await page.isVisible(navSel).catch(() => false);
    rec("chat-390/bar-visible", barVisible, `visible=${barVisible}`);
    const tabs = await tabInfo(page);
    const active = tabs.filter((t) => t.ariaCurrent === "page").map((t) => t.label);
    rec("chat-390/coach-active", active.length === 1 && active[0] === "Coach", `aria-current=page on ${JSON.stringify(active)}`);
    const geo = await page.evaluate((sel) => {
      const bar = document.querySelector(sel).getBoundingClientRect();
      const c = document.querySelector('[data-testid="multimodal-input"]');
      const send = document.querySelector('[data-testid="send-button"]');
      let cb = c ? c.getBoundingClientRect().bottom : -1;
      if (send) cb = Math.max(cb, send.getBoundingClientRect().bottom);
      return { composerBottom: Math.round(cb), barTop: Math.round(bar.top) };
    }, navSel);
    rec("chat-390/composer-above-bar", geo.composerBottom > 0 && geo.composerBottom <= geo.barTop + 1, `composerBottom=${geo.composerBottom} barTop=${geo.barTop}`);
    await shot(page, `final-chat-390-dark.png`);
    await ctx.close();
  }

  await browser.close();

  // ---- write findings ----
  const pass = results.filter((r) => r.pass === true).length;
  const fail = results.filter((r) => r.pass === false).length;
  const note = results.filter((r) => r.pass === null).length;
  let md = `# P34-A FINAL verification (FIX-20 + FIX-21)\n\nGenerated ${new Date().toISOString()} against ${BASE} (shared prod DB, strictly read-only).\nCovers the post-refinement build: the utility nav group is uncaptioned everywhere and renders as a trailing block behind a hairline top border.\n\n**Totals: ${pass} PASS / ${fail} FAIL / ${note} NOTE**\n\n| # | Assertion | Result | Detail |\n|---|---|---|---|\n`;
  results.forEach((r, i) => {
    const tag = r.pass === true ? "PASS" : r.pass === false ? "FAIL" : "NOTE";
    md += `| ${i + 1} | ${r.id} | ${tag} | ${r.detail.replace(/\|/g, "\\|")} |\n`;
  });
  writeFileSync(join(OUT, "verify-final.md"), md);
  console.log(`\n=== ${pass} PASS / ${fail} FAIL / ${note} NOTE ===`);
  console.log(`findings -> ${join(OUT, "verify-final.md")}`);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
