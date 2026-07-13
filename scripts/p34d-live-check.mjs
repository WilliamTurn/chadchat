import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3600';
const EVID = path.resolve('evidence-p34d');
fs.mkdirSync(EVID, { recursive: true });

const consoleErrors = [];
const results = {};
function rec(k, pass, note = '') { results[k] = { pass, note }; console.log(`[${pass ? 'PASS' : 'FAIL'}] ${k}${note ? ' :: ' + note : ''}`); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

try {
  // ---- STEP 1: login via credentials form ----
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.fill('input[type="email"], input[name="email"]', 'claude-testing@example.com');
  await page.fill('input[type="password"], input[name="password"]', '12345678');
  // Find the submit button inside the same form as the password input, avoid Google OAuth
  const submitted = await page.evaluate(() => {
    const pw = document.querySelector('input[type="password"]');
    if (!pw) return 'no-password-input';
    const form = pw.closest('form');
    if (!form) return 'no-form';
    const btn = form.querySelector('button[type="submit"], button:not([type])') ||
      Array.from(form.querySelectorAll('button')).find(b => /sign in|log in|continue|submit/i.test(b.textContent || ''));
    if (!btn) return 'no-submit-btn';
    btn.setAttribute('data-p34d-submit', '1');
    return 'ok:' + (btn.textContent || '').trim();
  });
  console.log('login submit resolution:', submitted);
  if (submitted.startsWith('ok')) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {}),
      page.click('[data-p34d-submit="1"]'),
    ]);
  }
  await page.waitForTimeout(1500);
  const afterLoginUrl = page.url();
  console.log('after-login url:', afterLoginUrl);
  const loggedIn = !/\/login/i.test(afterLoginUrl);
  rec('LOGIN', loggedIn, afterLoginUrl);

  // ---- STEP 2: /workouts ----
  await page.goto(`${BASE}/workouts`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const body2 = await page.evaluate(() => document.body.innerText);
  const hasErrorState = /something went wrong|application error|unhandled|500|error occurred/i.test(body2) &&
    !/Chad's Training Plan/i.test(body2);
  rec('2a-renders-no-error', !hasErrorState, hasErrorState ? 'error-like text found' : '');
  const hasPlanSection = /Chad'?s Training Plan/i.test(body2);
  rec('2b-training-plan-section', hasPlanSection);
  const hasPlanName = /P34-D Verification Split \(safe to delete\)/i.test(body2);
  rec('2c-plan-name', hasPlanName);
  const day1 = /Day 1:\s*Upper/i.test(body2);
  const day2 = /Day 2:\s*Lower/i.test(body2);
  const day3 = /Day 3:\s*Full Body/i.test(body2);
  const startBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a')).map(b => (b.textContent || '').trim()).filter(t => /^Start\b/i.test(t)));
  rec('2c-three-day-cards', day1 && day2 && day3, `d1=${day1} d2=${day2} d3=${day3}`);
  rec('2c-start-buttons', startBtns.length >= 3, 'start buttons: ' + JSON.stringify(startBtns));

  // screenshot plan section
  let shot2 = path.join(EVID, 'live-workouts-plan-section.png');
  const planEl = await page.evaluateHandle(() => {
    const nodes = Array.from(document.querySelectorAll('*'));
    const h = nodes.find(n => /Chad'?s Training Plan/i.test(n.textContent || '') &&
      n.children.length && (n.tagName === 'SECTION' || n.tagName === 'DIV'));
    // climb to a reasonable container
    let el = nodes.find(n => /Chad'?s Training Plan/i.test((n.textContent || '')));
    return el || document.body;
  });
  try {
    const box = await planEl.asElement()?.boundingBox();
    if (box) await planEl.asElement().screenshot({ path: shot2 });
    else await page.screenshot({ path: shot2, fullPage: true });
  } catch { await page.screenshot({ path: shot2, fullPage: true }); }

  // ---- STEP 3: /plans/<id> ----
  const PLAN_ID = 'b44b64ac-9be0-4a39-b1b1-02980763d298';
  await page.goto(`${BASE}/plans/${PLAN_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const body3 = await page.evaluate(() => document.body.innerText);
  const p3err = /something went wrong|application error|unhandled/i.test(body3) && !/Weekly schedule/i.test(body3);
  rec('3a-renders', !p3err);
  const hasWeekly = /Weekly schedule/i.test(body3);
  rec('3b-weekly-schedule', hasWeekly);
  const hasPrescription = /4\s*[x×]\s*4-6\s*@\s*185\s*lb\s*·?\s*RPE\s*8/i.test(body3) || /4\s*[x×]\s*4-6\s*@\s*185\s*lb/i.test(body3);
  rec('3b-prescription-format', hasPrescription, hasPrescription ? '' : 'no "4 x 4-6 @ 185 lb · RPE 8" found');
  const notDoneCount = (body3.match(/Not done yet/gi) || []).length;
  rec('3c-not-done-yet', notDoneCount >= 3, `count=${notDoneCount}`);
  const upNextCount = (body3.match(/Up next/gi) || []).length;
  // Check up-next is on Day 1 specifically
  const upNextOnDay1 = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('*'));
    const badges = nodes.filter(n => n.children.length === 0 && /^Up next$/i.test((n.textContent || '').trim()));
    if (badges.length !== 1) return { count: badges.length, onDay1: false };
    // walk up to find a row containing "Day 1: Upper"
    let el = badges[0];
    for (let i = 0; i < 8 && el; i++) { if (/Day 1:\s*Upper/i.test(el.textContent || '')) return { count: 1, onDay1: true }; el = el.parentElement; }
    return { count: 1, onDay1: false };
  });
  rec('3d-one-upnext-badge', upNextCount === 1 && upNextOnDay1.count === 1, `textCount=${upNextCount} domBadges=${upNextOnDay1.count}`);
  rec('3d-upnext-on-day1', upNextOnDay1.onDay1, JSON.stringify(upNextOnDay1));
  const hasRawDoc = /##\s*Day 1:\s*Upper/i.test(body3) || /Day 1:\s*Upper/i.test(body3);
  // check for markdown raw doc presence: look for '## Day 1' literally in DOM text or rendered heading after schedule
  const rawDocPresent = await page.evaluate(() => {
    const t = document.body.innerText;
    // raw markdown '## Day 1' may render as heading; check there's a large text block referencing Day 1 Upper twice
    const occ = (t.match(/Day 1:\s*Upper/gi) || []).length;
    return { occ, hasHashHeading: /##\s*Day 1/i.test(t) };
  });
  rec('3e-raw-plan-doc', rawDocPresent.occ >= 2 || rawDocPresent.hasHashHeading, JSON.stringify(rawDocPresent));
  await page.screenshot({ path: path.join(EVID, 'live-plan-detail.png'), fullPage: true });

  // ---- STEP 4: start Day 1 from /workouts ----
  await page.goto(`${BASE}/workouts`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const clicked = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, a'));
    const t = els.find(b => /Start Day 1:\s*Upper/i.test((b.textContent || '').trim()));
    if (t) { t.setAttribute('data-p34d-start', '1'); return (t.textContent || '').trim(); }
    // fallback: first Start button
    const f = els.find(b => /^Start\b/i.test((b.textContent || '').trim()));
    if (f) { f.setAttribute('data-p34d-start', '1'); return 'FALLBACK:' + (f.textContent || '').trim(); }
    return null;
  });
  console.log('start click target:', clicked);
  if (clicked) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.click('[data-p34d-start="1"]'),
    ]);
  }
  await page.waitForTimeout(1500);
  const sessUrl = page.url();
  console.log('session url:', sessUrl);
  rec('4-nav-session', /\/workouts\/session/i.test(sessUrl), sessUrl);
  const body4 = await page.evaluate(() => document.body.innerText);
  const bench = /Barbell Bench Press/i.test(body4);
  const row = /Barbell Row/i.test(body4);
  const ohp = /Overhead Press/i.test(body4);
  rec('4-prefill-exercises', bench && row && ohp, `bench=${bench} row=${row} ohp=${ohp}`);
  const targetLabel = /4\s*[x×]\s*4-6\s*@\s*185\s*lb/i.test(body4);
  rec('4-target-labels', targetLabel, targetLabel ? '' : 'no "4 x 4-6 @ 185 lb" target label');
  await page.screenshot({ path: path.join(EVID, 'live-session-prefill.png'), fullPage: true });

  // leave without saving; handle confirm dialog if any
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(`${BASE}/workouts`, { waitUntil: 'domcontentloaded' }).catch(() => {});
} catch (err) {
  console.log('SCRIPT ERROR:', err && err.stack || String(err));
  rec('SCRIPT', false, String(err));
} finally {
  console.log('\n===== CONSOLE ERRORS (' + consoleErrors.length + ') =====');
  consoleErrors.forEach((e, i) => console.log(`  #${i + 1}: ${e}`));
  console.log('\n===== RESULTS JSON =====');
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}
