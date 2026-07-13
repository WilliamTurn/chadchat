// p34a-capture-refs.mjs
// Reference-capture for a benchmark teardown of mobile-web bottom navigation bars.
// Node Playwright (NOT the MCP browser). Emulates iPhone 12 (390x844, touch, mobile UA, dsf 3).
// Output: chadchat/evidence-p34a/references/
//
// Rules honored: writes ONLY under evidence-p34a/. No dev server. Only the listed sites.
// Honest gaps beat fabricated data: if a site blocks or renders no bottom bar, it's recorded as such.

import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..'); // chadchat/
const OUT = path.join(REPO, 'evidence-p34a', 'references');
fs.mkdirSync(OUT, { recursive: true });

const iPhone12 = devices['iPhone 12']; // 390x844, dsf 3, touch, mobile UA

// ---------------------------------------------------------------------------
// In-page bottom-bar detector + probe. Returns a rich JSON description or null.
// ---------------------------------------------------------------------------
function detectBarInPage() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : v;
  };

  const all = Array.from(document.querySelectorAll('*'));
  const candidates = [];
  for (const el of all) {
    let cs;
    try { cs = getComputedStyle(el); } catch { continue; }
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.6) continue;
    if (r.height < 32 || r.height > 150) continue;
    // Anchored to the bottom edge of the viewport (allow small overshoot for safe-area)
    if (r.bottom < vh - 10 || r.bottom > vh + 40) continue;
    if (r.top > vh - 20) continue; // must actually occupy bottom strip
    const interactive = el.querySelectorAll('a, button, [role="tab"], [role="link"], [role="button"]');
    if (interactive.length < 2) continue;
    candidates.push({ el, r, cs, tabCount: interactive.length });
  }
  if (!candidates.length) return null;

  // Prefer the widest, then the one with the most tabs, then the shortest (a real bar, not a banner).
  candidates.sort((a, b) =>
    (b.r.width - a.r.width) || (b.tabCount - a.tabCount) || (a.r.height - b.r.height)
  );
  const best = candidates[0];
  const el = best.el;
  const cs = best.cs;
  const r = best.r;

  // Outermost interactive descendants = the tab items.
  const rawTabs = Array.from(el.querySelectorAll('a, button, [role="tab"], [role="link"], [role="button"]'));
  const tabEls = rawTabs.filter((t) => {
    if (!(t.getBoundingClientRect().width > 0)) return false;
    return !rawTabs.some((o) => o !== t && o.contains(t));
  });

  const tabs = tabEls.map((t) => {
    const tr = t.getBoundingClientRect();
    const tcs = getComputedStyle(t);
    // icon: largest svg or img inside
    let icon = null;
    const glyphs = Array.from(t.querySelectorAll('svg, img'));
    if (glyphs.length) {
      const g = glyphs
        .map((x) => ({ x, b: x.getBoundingClientRect() }))
        .sort((a, b) => (b.b.width * b.b.height) - (a.b.width * a.b.height))[0];
      icon = { tag: g.x.tagName.toLowerCase(), w: Math.round(g.b.width), h: Math.round(g.b.height) };
    }
    // label: visible text
    const text = (t.innerText || t.textContent || '').trim().replace(/\s+/g, ' ');
    // font-size of a text-bearing descendant (or the tab itself)
    let labelFontSize = tcs.fontSize;
    let labelFontWeight = tcs.fontWeight;
    if (text) {
      const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim()) {
          const pcs = getComputedStyle(node.parentElement);
          labelFontSize = pcs.fontSize;
          labelFontWeight = pcs.fontWeight;
          break;
        }
      }
    }
    // active heuristics
    const ariaCurrent = t.getAttribute('aria-current');
    const ariaSelected = t.getAttribute('aria-selected');
    const cls = (t.className && t.className.baseVal !== undefined) ? t.className.baseVal : (t.getAttribute('class') || '');
    const activeByClass = /\b(active|selected|current|is-active)\b/i.test(cls);
    return {
      label: text || null,
      iconOnly: !text,
      w: Math.round(tr.width),
      h: Math.round(tr.height),
      x: Math.round(tr.left),
      y: Math.round(tr.top),
      meets44: tr.width >= 44 && tr.height >= 44,
      icon,
      labelFontSize,
      labelFontWeight,
      color: tcs.color,
      fill: tcs.fill,
      ariaCurrent: ariaCurrent || null,
      ariaSelected: ariaSelected || null,
      activeByClass,
      likelyActive: !!(ariaCurrent && ariaCurrent !== 'false') || (ariaSelected === 'true') || activeByClass,
    };
  });

  return {
    found: true,
    viewport: { w: vw, h: vh },
    tagName: el.tagName.toLowerCase(),
    id: el.id || null,
    classSample: (typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '')).slice(0, 160),
    ariaLabel: el.getAttribute('aria-label') || null,
    role: el.getAttribute('role') || null,
    box: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) },
    style: {
      position: cs.position,
      bottom: cs.bottom,
      height: cs.height,
      minHeight: cs.minHeight,
      paddingBottom: cs.paddingBottom,
      paddingBottomPx: toNum(cs.paddingBottom),
      paddingTop: cs.paddingTop,
      backgroundColor: cs.backgroundColor,
      backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter || 'none',
      borderTop: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
      boxShadow: cs.boxShadow,
      zIndex: cs.zIndex,
    },
    tabCount: tabs.length,
    tabs,
  };
}

// Best-effort: dismiss cookie/consent overlays that block the page.
async function dismissConsent(page) {
  const labels = ['Accept all', 'Accept All', 'I agree', 'Agree', 'Allow all', 'Got it', 'Accept', 'Reject all'];
  for (const l of labels) {
    try {
      const btn = page.getByRole('button', { name: l, exact: false });
      if (await btn.first().isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.first().click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(600);
        return l;
      }
    } catch { /* ignore */ }
  }
  return null;
}

// Best-effort focus of a search input. Returns {focused, note}.
async function tryFocusSearch(page, siteKey) {
  const note = [];
  // Site-specific trigger clicks first.
  const triggerSelectors = [
    'button[aria-label*="Search" i]',
    'a[aria-label*="Search" i]',
    '[aria-label*="Search" i][role="button"]',
    'button:has-text("Search")',
    '.searchbox',
    'ytm-searchbox',
    'button[title*="Search" i]',
  ];
  for (const sel of triggerSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 400 }).catch(() => false)) {
        await el.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(800);
        note.push(`clicked trigger ${sel}`);
        break;
      }
    } catch { /* ignore */ }
  }
  // Now find an input to focus.
  const inputSelectors = [
    'input[type="search"]',
    'input[aria-label*="Search" i]',
    'input[placeholder*="Search" i]',
    'input[name="q"]',
    'input[type="text"]',
    'input:not([type="hidden"])',
    '[contenteditable="true"]',
    '[role="combobox"] input',
  ];
  for (const sel of inputSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 400 }).catch(() => false)) {
        await el.focus({ timeout: 1500 }).catch(() => {});
        await el.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(900);
        note.push(`focused input ${sel}`);
        return { focused: true, note: note.join('; ') };
      }
    } catch { /* ignore */ }
  }
  return { focused: false, note: note.join('; ') || 'no reachable search input found' };
}

async function activeElementInfo(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    return {
      tag: a.tagName ? a.tagName.toLowerCase() : null,
      type: a.getAttribute ? a.getAttribute('type') : null,
      isTextInput: !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)),
    };
  });
}

const SITES = [
  { key: 'youtube', urls: ['https://m.youtube.com'] },
  { key: 'x', urls: ['https://x.com/explore', 'https://x.com'] },
  { key: 'instagram', urls: ['https://www.instagram.com/instagram/', 'https://www.instagram.com'] },
  { key: 'reddit', urls: ['https://www.reddit.com'] },
];

const results = [];

const browser = await chromium.launch({ headless: true });

async function loadFirstRenderable(context, urls, siteKey) {
  const page = await context.newPage();
  let loadedUrl = null;
  let lastErr = null;
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);
      loadedUrl = url;
      const consent = await dismissConsent(page);
      if (consent) await page.waitForTimeout(1200);
      // Give SPA a moment to hydrate the shell.
      await page.waitForTimeout(1500);
      break;
    } catch (e) {
      lastErr = e.message.split('\n')[0];
    }
  }
  return { page, loadedUrl, lastErr };
}

for (const site of SITES) {
  const rec = { key: site.key, urls: site.urls, loadedUrl: null, blocked: false, notes: [], bar: null, scroll: null, inputFocus: null, w320: null, error: null };
  const context = await browser.newContext({ ...iPhone12, locale: 'en-US' });
  try {
    const { page, loadedUrl, lastErr } = await loadFirstRenderable(context, site.urls, site.key);
    rec.loadedUrl = loadedUrl;
    if (!loadedUrl) {
      rec.error = `navigation failed: ${lastErr}`;
      rec.blocked = true;
      rec.notes.push(rec.error);
      await context.close();
      results.push(rec);
      console.log(`[${site.key}] NAV FAILED: ${lastErr}`);
      continue;
    }
    rec.title = await page.title().catch(() => null);
    // Short characterization of what the logged-out visitor actually sees (wall vs app shell).
    rec.gate = await page.evaluate(() => {
      const pick = (sel) => {
        const el = document.querySelector(sel);
        return el ? (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120) : null;
      };
      const h = pick('h1') || pick('h2') || pick('[role="heading"]');
      const body = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400);
      const hasLoginWords = /(log in|sign up|continue with|see full profile|open app|sign in to)/i.test(body);
      return { headline: h, hasLoginWords, snippet: body.slice(0, 180) };
    }).catch(() => null);

    // 1) default 390x844
    await page.screenshot({ path: path.join(OUT, `${site.key}-390-default.png`) }).catch((e) => rec.notes.push('default shot err: ' + e.message));
    const bar = await page.evaluate(detectBarInPage).catch((e) => { rec.notes.push('detect err: ' + e.message); return null; });
    rec.bar = bar;
    if (bar) {
      fs.writeFileSync(path.join(OUT, `${site.key}-probe.json`), JSON.stringify(bar, null, 2));
      console.log(`[${site.key}] bottom bar FOUND: <${bar.tagName}> h=${bar.box.h}px tabs=${bar.tabCount}`);
    } else {
      console.log(`[${site.key}] no bottom bar detected at load`);
      rec.notes.push('no bottom bar detected in default logged-out render');
    }

    // 2) scrolled ~800px
    await page.evaluate(() => {
      window.scrollTo(0, 800);
      // also nudge common internal scrollers
      const sc = document.scrollingElement;
      if (sc) sc.scrollTop = 800;
    }).catch(() => {});
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(OUT, `${site.key}-390-scrolled.png`) }).catch(() => {});
    const barAfter = await page.evaluate(detectBarInPage).catch(() => null);
    const scrollY = await page.evaluate(() => window.scrollY || (document.scrollingElement ? document.scrollingElement.scrollTop : 0)).catch(() => null);
    rec.scroll = {
      scrolledToY: scrollY,
      barStillDetected: !!barAfter,
      barBottomAfter: barAfter ? barAfter.box.bottom : null,
      persists: !!(barAfter && barAfter.box.bottom >= (barAfter.viewport.h - 12)),
      note: (bar && (scrollY === 0 || scrollY === null))
        ? 'page did not scroll (logged-out empty state / no scrollable feed) — scroll-persistence not exercised; bar is position:' + (bar.style.position) + ' bottom:0 so it is structurally pinned regardless'
        : (barAfter
          ? (barAfter.box.bottom >= barAfter.viewport.h - 12 ? 'bar persists pinned to bottom after scroll' : 'bar moved off the bottom edge after scroll (hide-on-scroll?)')
          : (bar ? 'bar not detected after scroll (possibly hidden on scroll-down)' : 'no bar to begin with')),
    };
    console.log(`[${site.key}] after scroll(y=${scrollY}): ${rec.scroll.note}`);

    // scroll back up to restore state for input probe
    await page.evaluate(() => { window.scrollTo(0, 0); const sc = document.scrollingElement; if (sc) sc.scrollTop = 0; }).catch(() => {});
    await page.waitForTimeout(800);

    // 3) input focus probe (MOST IMPORTANT)
    const probe = await tryFocusSearch(page, site.key).catch((e) => ({ focused: false, note: 'probe err: ' + e.message }));
    let ae = null;
    if (probe.focused) {
      ae = await activeElementInfo(page);
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, `${site.key}-390-input-focused.png`) }).catch(() => {});
      const barWithInput = await page.evaluate(detectBarInPage).catch(() => null);
      let interpretation;
      if (!bar) {
        interpretation = 'N/A — no bottom bar existed in the logged-out render (login/app wall), so there is no hide-on-focus behavior to observe';
      } else if (barWithInput) {
        interpretation = 'bottom bar REMAINS visible while search input focused';
      } else {
        interpretation = 'bottom bar HIDDEN while search input focused (bar removed/pushed off when the keyboard/search overlay opened)';
      }
      rec.inputFocus = {
        attempted: true,
        focused: true,
        activeElement: ae,
        note: probe.note,
        barExistedAtDefault: !!bar,
        barVisibleWhileInputFocused: !!barWithInput,
        barBottom: barWithInput ? barWithInput.box.bottom : null,
        interpretation,
      };
      console.log(`[${site.key}] input focus: ${rec.inputFocus.interpretation}`);
    } else {
      rec.inputFocus = { attempted: true, focused: false, note: probe.note };
      console.log(`[${site.key}] input focus: not reachable (${probe.note})`);
    }

    await page.close();

    // 4) 320x568 render in a fresh narrow context
    const ctx320 = await browser.newContext({
      ...iPhone12,
      viewport: { width: 320, height: 568 },
      screen: { width: 320, height: 568 },
    });
    try {
      const p320 = await ctx320.newPage();
      await p320.goto(rec.loadedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await p320.waitForTimeout(3500);
      await dismissConsent(p320);
      await p320.waitForTimeout(1200);
      await p320.screenshot({ path: path.join(OUT, `${site.key}-320-default.png`) }).catch(() => {});
      const bar320 = await p320.evaluate(detectBarInPage).catch(() => null);
      rec.w320 = {
        barDetected: !!bar320,
        height: bar320 ? bar320.box.h : null,
        width: bar320 ? bar320.box.w : null,
        fitsWidth: bar320 ? bar320.box.w <= 322 : null,
        tabLabels: bar320 ? bar320.tabs.map((t) => t.label || (t.iconOnly ? '(icon)' : '')) : null,
        anyLabelDropped: (bar && bar320)
          ? (bar.tabs.filter((t) => t.label).length !== bar320.tabs.filter((t) => t.label).length)
          : null,
      };
      console.log(`[${site.key}] 320px: bar ${bar320 ? 'present h=' + bar320.box.h : 'absent'}`);
      await p320.close();
    } catch (e) {
      rec.notes.push('320 render err: ' + e.message.split('\n')[0]);
    } finally {
      await ctx320.close();
    }
  } catch (e) {
    rec.error = e.message.split('\n')[0];
    rec.notes.push('fatal: ' + rec.error);
    console.log(`[${site.key}] ERROR: ${rec.error}`);
  } finally {
    await context.close();
  }
  results.push(rec);
}

await browser.close();

// Persist raw results for reference.
fs.writeFileSync(path.join(OUT, '_results.json'), JSON.stringify(results, null, 2));

// ---------------------------------------------------------------------------
// MANIFEST.md
// ---------------------------------------------------------------------------
function barAnatomy(rec) {
  const b = rec.bar;
  if (!b) return '- No bottom bar detected in the logged-out render.';
  const labels = b.tabs.map((t) => t.label || (t.iconOnly ? '(icon-only)' : '(?)'));
  const labeled = b.tabs.filter((t) => t.label).length;
  const iconOnly = b.tabs.filter((t) => t.iconOnly).length;
  const active = b.tabs.find((t) => t.likelyActive);
  const minTarget = b.tabs.reduce((m, t) => Math.min(m, Math.min(t.w, t.h)), Infinity);
  const all44 = b.tabs.every((t) => t.meets44);
  const fsizes = [...new Set(b.tabs.map((t) => t.labelFontSize).filter(Boolean))];
  return [
    `- Element: \`<${b.tagName}>\`${b.ariaLabel ? ` aria-label="${b.ariaLabel}"` : ''}${b.role ? ` role="${b.role}"` : ''}`,
    `- Bar height: ${b.box.h}px (computed height ${b.style.height}, min-height ${b.style.minHeight})`,
    `- Position: ${b.style.position}, bottom:${b.style.bottom}, z-index:${b.style.zIndex}`,
    `- Background: ${b.style.backgroundColor}; backdrop-filter: ${b.style.backdropFilter}`,
    `- Border-top: ${b.style.borderTop}; box-shadow: ${b.style.boxShadow}`,
    `- padding-bottom: ${b.style.paddingBottom} (${b.style.paddingBottomPx}px)${(typeof b.style.paddingBottomPx === 'number' && b.style.paddingBottomPx > 0) ? ' — likely safe-area / env() inset' : ' — no safe-area inset detected on desktop-emulated env'}`,
    `- Tabs: ${b.tabCount} — labels: ${labels.join(' | ')}`,
    `- Label pattern: ${labeled} labeled, ${iconOnly} icon-only ${labeled && iconOnly ? '(mixed)' : labeled ? '(icon+label)' : '(icon-only)'}${fsizes.length ? `; label font-size ${fsizes.join('/')}` : ''}`,
    `- Active tab: ${active ? `"${active.label || '(icon)'}" — color ${active.color}${active.ariaCurrent ? `, aria-current="${active.ariaCurrent}"` : ''}${active.ariaSelected ? `, aria-selected="${active.ariaSelected}"` : ''}${active.activeByClass ? ', active class' : ''}` : 'not clearly distinguishable via aria/class'}`,
    `- Touch targets: min tab dimension ${Number.isFinite(minTarget) ? minTarget + 'px' : 'n/a'}; all >= 44px: ${all44 ? 'YES' : 'NO'}`,
  ].join('\n');
}

const lines = [];
lines.push('# P34A Reference Capture — Mobile-Web Bottom Navigation Bars');
lines.push('');
lines.push(`Captured: ${new Date().toISOString()}`);
lines.push('');
lines.push('Emulation: iPhone 12 (390x844, deviceScaleFactor 3, touch, mobile UA) via Node Playwright (chromium ' + '134). Also re-rendered at 320x568.');
lines.push('');
lines.push('Screenshots are viewport captures (not fullPage) so the fixed bottom bar is visible in frame.');
lines.push('');
lines.push('## Summary table');
lines.push('');
lines.push('| Site | Loaded | Bottom bar | Height | Labels | Tabs | Scroll | Input-focus |');
lines.push('|------|--------|-----------|--------|--------|------|--------|-------------|');
for (const r of results) {
  const b = r.bar;
  const labelPat = b ? (b.tabs.every((t) => t.label) ? 'icon+label' : b.tabs.some((t) => t.label) ? 'mixed' : 'icon-only') : '-';
  const scroll = r.scroll ? (r.scroll.persists ? 'persists' : (r.scroll.barStillDetected ? 'moves' : 'hidden/none')) : '-';
  const inp = r.inputFocus
    ? (r.inputFocus.focused
        ? (!b ? 'n/a (no bar)' : (r.inputFocus.barVisibleWhileInputFocused ? 'bar stays' : 'bar hidden'))
        : 'no input')
    : '-';
  lines.push(`| ${r.key} | ${r.loadedUrl ? 'yes' : 'NO'} | ${b ? 'YES' : (r.blocked ? 'blocked' : 'none')} | ${b ? b.box.h + 'px' : '-'} | ${labelPat} | ${b ? b.tabCount : '-'} | ${scroll} | ${inp} |`);
}
lines.push('');

for (const r of results) {
  lines.push(`## ${r.key}`);
  lines.push('');
  lines.push(`- URL loaded: ${r.loadedUrl || 'NONE (navigation failed)'}`);
  if (r.title) lines.push(`- Page title: ${r.title}`);
  if (r.gate) {
    if (!r.bar) {
      lines.push(`- Logged-out gate: NO bottom nav rendered. ${r.gate.hasLoginWords ? 'A login/app-install wall was shown' : 'App shell rendered but no bottom bar'}${r.gate.headline ? ` (headline: "${r.gate.headline}")` : ''}.`);
    } else if (r.gate.headline) {
      lines.push(`- Logged-out state headline: "${r.gate.headline}".`);
    }
  }
  if (r.error) lines.push(`- Error: ${r.error}`);
  lines.push('');
  lines.push('### Bar anatomy');
  lines.push(barAnatomy(r));
  lines.push('');
  lines.push('### Scroll behavior');
  if (r.scroll) {
    lines.push(`- Scrolled to y=${r.scroll.scrolledToY}. ${r.scroll.note}. Bar bottom after scroll: ${r.scroll.barBottomAfter ?? 'n/a'}.`);
  } else {
    lines.push('- Not measured.');
  }
  lines.push('');
  lines.push('### Input-focus behavior (key probe)');
  if (r.inputFocus && r.inputFocus.focused) {
    lines.push(`- Focused a text input (${r.inputFocus.activeElement ? r.inputFocus.activeElement.tag + (r.inputFocus.activeElement.type ? '[' + r.inputFocus.activeElement.type + ']' : '') : 'input'}). ${r.inputFocus.interpretation}. (${r.inputFocus.note})`);
  } else if (r.inputFocus) {
    lines.push(`- No reachable search input: ${r.inputFocus.note}. (No input-focused screenshot produced.)`);
  } else {
    lines.push('- Not measured.');
  }
  lines.push('');
  lines.push('### 320x568 render');
  if (r.w320) {
    lines.push(`- Bar ${r.w320.barDetected ? 'present' : 'absent'}${r.w320.barDetected ? ` (h=${r.w320.height}px, w=${r.w320.width}px, fits width: ${r.w320.fitsWidth})` : ''}.`);
    if (r.w320.tabLabels) lines.push(`- Tab labels at 320: ${r.w320.tabLabels.join(' | ')}. Labels dropped vs 390: ${r.w320.anyLabelDropped === null ? 'n/a' : r.w320.anyLabelDropped}.`);
  } else {
    lines.push('- Not captured.');
  }
  lines.push('');
  if (r.notes.length) {
    lines.push('### Notes');
    for (const n of r.notes) lines.push('- ' + n);
    lines.push('');
  }
  lines.push('### Files');
  const prefix = r.key;
  for (const f of [`${prefix}-390-default.png`, `${prefix}-390-scrolled.png`, `${prefix}-390-input-focused.png`, `${prefix}-320-default.png`, `${prefix}-probe.json`]) {
    lines.push(`- ${fs.existsSync(path.join(OUT, f)) ? '[x]' : '[ ]'} ${f}`);
  }
  lines.push('');
}

fs.writeFileSync(path.join(OUT, 'MANIFEST.md'), lines.join('\n'));
console.log('\nWrote MANIFEST.md and _results.json to', OUT);
