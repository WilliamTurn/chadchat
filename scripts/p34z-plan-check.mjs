import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3600';
const PLAN_ID = '07cf1686-d738-4336-b183-ad9b2a330200';
const EVID = path.resolve('evidence-p34z');
fs.mkdirSync(EVID, { recursive: true });

const consoleErrors = [];
const results = {};
let workoutId = null;
function rec(k, pass, note = '') { results[k] = { pass, note }; console.log(`[${pass ? 'PASS' : 'FAIL'}] ${k}${note ? ' :: ' + note : ''}`); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

async function waitUrl(re, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (re.test(page.url())) return true;
    await page.waitForTimeout(200);
  }
  return re.test(page.url());
}

try {
  // ---- STEP 1: login ----
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.fill('input[type="email"], input[name="email"]', 'claude-testing@example.com');
  await page.fill('input[type="password"], input[name="password"]', '12345678');
  const submitted = await page.evaluate(() => {
    const pw = document.querySelector('input[type="password"]');
    const form = pw && pw.closest('form');
    if (!form) return 'no-form';
    const btn = form.querySelector('button[type="submit"], button:not([type])') ||
      Array.from(form.querySelectorAll('button')).find(b => /sign in|log in|continue|submit/i.test(b.textContent || ''));
    if (!btn) return 'no-submit-btn';
    btn.setAttribute('data-p34z-submit', '1');
    return 'ok';
  });
  if (submitted === 'ok') {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {}),
      page.click('[data-p34z-submit="1"]'),
    ]);
  }
  await page.waitForTimeout(1500);
  const loggedIn = !/\/login/i.test(page.url());
  rec('1-login', loggedIn, page.url());

  // ---- STEP 2: /workouts (lazy materialization) + screenshot plan section ----
  await page.goto(`${BASE}/workouts`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const body2 = await page.evaluate(() => document.body.innerText);
  const hasPlanSection = /Chad'?s Training Plan/i.test(body2);
  const day1 = /Day 1:\s*Upper/i.test(body2);
  const day2 = /Day 2:\s*Lower/i.test(body2);
  const day3 = /Day 3:\s*Full Body/i.test(body2);
  rec('2-plan-section', hasPlanSection && day1 && day2 && day3, `plan=${hasPlanSection} d1=${day1} d2=${day2} d3=${day3}`);
  // Screenshot the plan section element specifically
  const secHandle = await page.evaluateHandle(() => {
    const secs = Array.from(document.querySelectorAll('section'));
    return secs.find(s => /Chad'?s Training Plan/i.test(s.textContent || '')) || document.body;
  });
  try {
    const el = secHandle.asElement();
    const box = el && await el.boundingBox();
    if (box) await el.screenshot({ path: path.join(EVID, '01-workouts-plan-section.png') });
    else await page.screenshot({ path: path.join(EVID, '01-workouts-plan-section.png'), fullPage: true });
  } catch { await page.screenshot({ path: path.join(EVID, '01-workouts-plan-section.png'), fullPage: true }); }

  // ---- STEP 3: Start Day 1, finish + save ----
  const startClicked = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, a'));
    const t = els.find(b => /Start Day 1:\s*Upper/i.test((b.textContent || '').trim()));
    if (t) { t.setAttribute('data-p34z-start', '1'); return (t.textContent || '').trim(); }
    return null;
  });
  console.log('start target:', startClicked);
  rec('3-start-button-present', Boolean(startClicked), String(startClicked));
  if (startClicked) {
    await page.click('[data-p34z-start="1"]');
  }
  await waitUrl(/\/workouts\/session/i, 15000);
  await page.waitForTimeout(1500);
  rec('3-on-session', /\/workouts\/session/i.test(page.url()), page.url());
  await page.screenshot({ path: path.join(EVID, '02-session-prefill.png'), fullPage: true });

  // Click Finish
  const finishClicked = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button'));
    const b = els.find(x => /^Finish$/i.test((x.textContent || '').trim()));
    if (b) { b.setAttribute('data-p34z-finish', '1'); return true; }
    return false;
  });
  console.log('finish button found:', finishClicked);
  if (finishClicked) {
    await page.click('[data-p34z-finish="1"]');
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(EVID, '03-finish-dialog.png'), fullPage: true });

  // Confirm "Finish and save"
  const confirmClicked = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button'));
    const b = els.find(x => /Finish and save/i.test((x.textContent || '').trim()));
    if (b) { b.setAttribute('data-p34z-confirm', '1'); return true; }
    return false;
  });
  console.log('confirm button found:', confirmClicked);
  if (confirmClicked) {
    await page.click('[data-p34z-confirm="1"]');
  }
  await waitUrl(/\/workouts\/history\//i, 20000);
  await page.waitForTimeout(1500);
  const histUrl = page.url();
  const m = histUrl.match(/\/workouts\/history\/([0-9a-f-]{36})/i);
  workoutId = m ? m[1] : null;
  rec('3-saved-workout', Boolean(workoutId), `url=${histUrl} workoutId=${workoutId}`);
  await page.screenshot({ path: path.join(EVID, '04-workout-saved.png'), fullPage: true });

  // ---- STEP 4: /plans/[id] verify Last done + Up next -> Day 2 ----
  await page.goto(`${BASE}/plans/${PLAN_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const sched = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('li'));
    const rows = [];
    for (const li of items) {
      const t = li.textContent || '';
      const mday = t.match(/Day\s*\d+:\s*[A-Za-z ]+/);
      if (!mday) continue;
      const name = mday[0].trim();
      if (!/^Day \d+:/.test(name)) continue;
      // only the schedule rows (they contain "Last done" or "Not done yet")
      if (!/Last done|Not done yet/i.test(t)) continue;
      rows.push({
        name,
        lastDone: /Last done/i.test(t),
        lastDoneText: (t.match(/Last done[^\n]*/i) || [''])[0].trim(),
        notDone: /Not done yet/i.test(t),
        upNext: /Up next/i.test(t),
      });
    }
    return rows;
  });
  console.log('schedule rows:', JSON.stringify(sched, null, 2));
  const d1 = sched.find(r => /Day 1:/i.test(r.name));
  const d2 = sched.find(r => /Day 2:/i.test(r.name));
  const day1Done = Boolean(d1 && d1.lastDone && !d1.notDone);
  rec('4a-day1-last-done', day1Done, d1 ? JSON.stringify(d1) : 'day1 row not found');
  const upNextOnDay2 = Boolean(d2 && d2.upNext) && !(d1 && d1.upNext);
  rec('4b-upnext-day2', upNextOnDay2, `d1.upNext=${d1 && d1.upNext} d2.upNext=${d2 && d2.upNext}`);
  await page.screenshot({ path: path.join(EVID, '05-plan-schedule.png'), fullPage: true });

  // ---- STEP 5: open saved workout (closest to "edit path"); no re-save-to-completion path exists ----
  await page.goto(`${BASE}/workouts/history/${workoutId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const detailOk = await page.evaluate(() => /What you did|Workout complete/i.test(document.body.innerText));
  rec('5-workout-detail-opens', detailOk, '');
  await page.screenshot({ path: path.join(EVID, '06-workout-detail.png'), fullPage: true });
} catch (err) {
  console.log('SCRIPT ERROR:', (err && err.stack) || String(err));
  rec('SCRIPT', false, String(err));
} finally {
  console.log('\n===== WORKOUT ID =====\n', workoutId);
  console.log('\n===== CONSOLE ERRORS (' + consoleErrors.length + ') =====');
  consoleErrors.forEach((e, i) => console.log(`  #${i + 1}: ${e}`));
  console.log('\n===== RESULTS JSON =====');
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(EVID, 'run-output.json'), JSON.stringify({ workoutId, results, consoleErrors }, null, 2));
  await browser.close();
}
