// Phase 1 contract-layer invariants (DSH-66). Run with: pnpm test:unit
//
// These tests pin the contracts themselves: registry consistency, the
// missing-is-never-zero rule, claim thresholds (including the exact failure
// classes from the audits: the zero-data strength claim and the DSH-62
// goal-overshoot contradiction), banned system copy, canonical formatting,
// the owner-law slots (visual + week-strip, logger capabilities), and the
// deterministic fixtures resolving to their declared panel states through
// member-local (America/Chicago) day math.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  canClaim,
  goalStanding,
  isGoalReached,
} from "../../lib/contracts/claims";
import {
  type Coverage,
  loggedReading,
  readingFromRows,
  resolvePanelState,
  unloggedReading,
} from "../../lib/contracts/data-state";
import { findBannedCopy } from "../../lib/contracts/copy";
import {
  canClaimForMetric,
  coverageWindowDays,
  type MetricDef,
  METRICS,
  type MetricId,
} from "../../lib/contracts/metrics";
import {
  LOGGABLE_DOMAINS,
  PANEL_ROLES,
  REQUIRED_LOGGER_CAPABILITIES,
} from "../../lib/contracts/panels";
import { DOMAINS, ROUTES } from "../../lib/contracts/routes";
import {
  formatMinutesAsDuration,
  formatQuantity,
  formatVsTarget,
  kgToLb,
  lbToKg,
  UNITS,
} from "../../lib/contracts/units";
import { ema } from "../../lib/chart/trend";
import { calendarDayAnchorInTz } from "../../lib/date";
import { workoutVolumeLb } from "../../lib/workouts/stats";
import {
  FIXTURE_TIMEZONE,
  fixtureCoverage,
  fixtureDayAnchorMs,
  PERSONAS,
  type Persona,
  type PersonaExpectations,
} from "../fixtures/dashboard-states";

const DAY_MS = 86_400_000;

/* ------------------------------------------------------ registry invariants */

test("every metric names a source module and symbol that actually exist", () => {
  const sources = new Map<string, string>();
  for (const [id, m] of Object.entries(METRICS)) {
    const p = path.resolve(process.cwd(), m.source.module);
    assert.ok(
      existsSync(p),
      `${id}: metric source module missing on disk: ${m.source.module}`
    );
    let src = sources.get(p);
    if (!src) {
      src = readFileSync(p, "utf8");
      sources.set(p, src);
    }
    assert.ok(
      src.includes(m.source.symbol),
      `${id}: symbol "${m.source.symbol}" not found in ${m.source.module}`
    );
  }
});

test("every registered route has a real page under app/", () => {
  for (const r of Object.values(ROUTES)) {
    const rel = r.path === "/" ? "(chat)" : r.path.slice(1);
    const p = path.resolve(process.cwd(), "app", rel, "page.tsx");
    assert.ok(existsSync(p), `route ${r.path} has no page at app/${rel}`);
  }
});

test("every metric's unit, domain, and surfaces are registered", () => {
  for (const [id, m] of Object.entries(METRICS)) {
    assert.ok(m.unit in UNITS, `${id}: unknown unit ${m.unit}`);
    assert.ok(m.domain in DOMAINS, `${id}: unknown domain ${m.domain}`);
    for (const s of m.surfaces) {
      assert.ok(s in ROUTES, `${id}: unregistered surface ${s}`);
    }
    assert.ok(m.allowedClaims.length > 0, `${id}: no allowed claims`);
    assert.ok(
      coverageWindowDays(id as MetricId) > 0,
      `${id}: no coverage window`
    );
  }
});

test("route registry and lib/nav-links.ts cannot drift", async () => {
  const { NAV_LINKS } = await import("../../lib/nav-links");
  for (const link of NAV_LINKS) {
    const route = ROUTES[link.href as keyof typeof ROUTES];
    assert.ok(route, `nav link ${link.href} is not in the route registry`);
    assert.equal(
      route.name,
      link.label,
      `${link.href}: registry name "${route.name}" != nav label "${link.label}"`
    );
  }
});

test("route paths are canonical and unique", () => {
  const paths = Object.values(ROUTES).map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const [key, r] of Object.entries(ROUTES)) {
    assert.equal(key, r.path, `route key ${key} != path ${r.path}`);
  }
});

/* -------------------------------------------------- owner-law contract pins */

test("every panel role requires a real visual (owner law s181)", () => {
  for (const role of Object.values(PANEL_ROLES)) {
    assert.ok(
      role.requiredSlots.includes("visual"),
      `role ${role.role} does not require a visual slot`
    );
  }
  // Trackers carry strip AND chart: separate required slots.
  assert.ok(PANEL_ROLES["quick-log"].requiredSlots.includes("week-strip"));
});

test("the logger capability law keeps all six capabilities", () => {
  assert.deepEqual(
    [...REQUIRED_LOGGER_CAPABILITIES].sort(),
    [
      "delete-entry-confirmed",
      "edit-entry",
      "immediate-refresh",
      "log-now",
      "log-past-day",
      "undo-after-quick-add",
    ]
  );
});

/* ------------------------------------------------- missing is never zero */

test("unlogged and zero are structurally different", () => {
  const none = readingFromRows(
    [] as number[],
    (rows) => rows.reduce((a, b) => a + b, 0),
    fixtureCoverage([], 7)
  );
  assert.equal(none.status, "unlogged");
  assert.ok(!("value" in none), "unlogged reading must carry no value");

  const zero = readingFromRows(
    [0],
    (rows) => rows.reduce((a, b) => a + b, 0),
    fixtureCoverage([0], 7)
  );
  assert.equal(zero.status, "logged");
  assert.equal(zero.status === "logged" && zero.value, 0);
});

test("only logged-event counts opt into rendering zero", () => {
  const zeroMetrics = (Object.keys(METRICS) as MetricId[]).filter(
    (id) => (METRICS[id] as MetricDef).missingRendersAs === "zero"
  );
  assert.deepEqual(zeroMetrics.sort(), [
    "nutrition.meals.today",
    "training.prs",
    "training.sessions.thisWeek",
  ]);
});

test("panel state precedence: locked > loading > error > data", () => {
  const reading = loggedReading(42, {
    coverage: fixtureCoverage([0, 1, 2], 7),
  });
  const base = { reading, staleAfterDays: null } as const;
  assert.equal(
    resolvePanelState({ ...base, locked: true, fetch: "loading" }),
    "locked"
  );
  assert.equal(
    resolvePanelState({ ...base, locked: false, fetch: "loading" }),
    "loading"
  );
  assert.equal(
    resolvePanelState({ ...base, locked: false, fetch: "error" }),
    "error"
  );
  assert.equal(
    resolvePanelState({ ...base, locked: false, fetch: "ready" }),
    "populated"
  );
  assert.equal(
    resolvePanelState({
      locked: false,
      fetch: "ready",
      reading: unloggedReading(),
      staleAfterDays: null,
    }),
    "empty"
  );
});

test("stale wins over sparse and populated once past the threshold", () => {
  const reading = loggedReading(202.1, {
    coverage: fixtureCoverage([12, 14, 16], 30),
    ageDays: 12,
  });
  assert.equal(
    resolvePanelState({
      locked: false,
      fetch: "ready",
      reading,
      staleAfterDays: 10,
    }),
    "stale"
  );
});

/* ------------------------------------------------------- claim governance */

test("no trend claim from sparse data", () => {
  const sparse: Coverage = fixtureCoverage([0, 1], 7);
  assert.equal(canClaim("trend-direction", sparse).allowed, false);
  assert.equal(canClaim("rate", sparse).allowed, false);
  assert.equal(canClaim("eta", sparse).allowed, false);
});

test("the zero-data strength claim is impossible", () => {
  // The weekly report once asserted lost strength from ZERO strength data.
  const none: Coverage = fixtureCoverage([], 28);
  const verdict = canClaim("strength-change", none);
  assert.equal(verdict.allowed, false);
});

test("adherence needs real coverage; 1 of 7 days is not a percentage", () => {
  assert.equal(
    canClaim("adherence", fixtureCoverage([0], 7)).allowed,
    false
  );
  assert.equal(
    canClaim("adherence", fixtureCoverage([0, 1, 3, 5], 7)).allowed,
    true
  );
});

test("causal claims: system never; Chad only with evidence attached", () => {
  const rich: Coverage = fixtureCoverage(
    Array.from({ length: 28 }, (_, i) => i),
    28
  );
  assert.equal(canClaim("causal", rich).allowed, false);
  assert.equal(
    canClaim("causal", rich, { surface: "coach-interpretation" }).allowed,
    false
  );
  assert.equal(
    canClaim("causal", rich, {
      surface: "coach-interpretation",
      hasEvidence: true,
    }).allowed,
    true
  );
});

test("trend allowed with 3+ points across a week", () => {
  assert.equal(
    canClaim("trend-direction", fixtureCoverage([0, 4, 8], 30)).allowed,
    true
  );
});

test("a metric's claim allowlist is enforced at any coverage", () => {
  const rich: Coverage = fixtureCoverage(
    Array.from({ length: 28 }, (_, i) => i),
    28
  );
  // Calories today never supports an ETA, no matter how much data exists.
  assert.equal(
    canClaimForMetric("nutrition.calories.today", "eta", rich).allowed,
    false
  );
  assert.equal(
    canClaimForMetric("body.weight.trend", "eta", rich).allowed,
    true
  );
});

/* --------------------------------------------- goal standing (DSH-62 spec) */

test("overshooting a loss target reads REACHED, never moving-away", () => {
  // Start 205, target 180, now 178.7: past the target in the goal direction.
  assert.equal(isGoalReached(205, 180, 178.7), true);
  const standing = goalStanding({
    start: 205,
    target: 180,
    current: 178.7,
    ratePerWeek: -0.3,
    coverage: fixtureCoverage([0, 2, 4, 6, 8, 10], 42),
  });
  assert.equal(standing, "reached");
});

test("gain goals reach in the other direction", () => {
  assert.equal(isGoalReached(160, 175, 176.2), true);
  assert.equal(isGoalReached(160, 175, 172.0), false);
});

test("standing needs RATE coverage before any direction language", () => {
  // One weigh-in: nothing to say.
  assert.equal(
    goalStanding({
      start: 205,
      target: 180,
      current: 200,
      ratePerWeek: -0.8,
      coverage: fixtureCoverage([0], 7),
    }),
    "insufficient-data"
  );
  // Six days in with 3 weigh-ins: clears trend-direction but NOT the rate
  // policy; the member must never see "moving away" from week-one noise.
  assert.equal(
    goalStanding({
      start: 205,
      target: 180,
      current: 204.2,
      ratePerWeek: 1.1,
      coverage: fixtureCoverage([0, 3, 6], 7),
    }),
    "insufficient-data"
  );
});

test("moving away from the target reads off-track (with rate coverage)", () => {
  const standing = goalStanding({
    start: 205,
    target: 180,
    current: 200,
    ratePerWeek: 0.9,
    coverage: fixtureCoverage([0, 3, 6, 9, 12, 15], 30),
  });
  assert.equal(standing, "off-track");
});

test("a negligible rate reads holding, not a direction verdict", () => {
  const standing = goalStanding({
    start: 205,
    target: 180,
    current: 195,
    ratePerWeek: 0.1,
    coverage: fixtureCoverage([0, 3, 6, 9, 12, 15], 30),
  });
  assert.equal(standing, "holding");
});

/* --------------------------------------------------------- banned copy */

test("the snark tripwires catch the known offenders", () => {
  const offenders = [
    "Here's where you stand today. No excuses, just the numbers.",
    "On the one day you actually showed up...",
    "Your hydration and recovery are abysmal.",
    "View all →",
    "It's not a diet, it's a lifestyle.",
    `Weight trend ${String.fromCharCode(0x20_14)} last 30 days`,
  ];
  for (const s of offenders) {
    assert.ok(
      findBannedCopy(s).length > 0,
      `should have flagged: "${s}"`
    );
  }
});

test("approved pro-app copy passes clean", () => {
  const clean = [
    "Log meal",
    "No meals logged today. Log your first meal to update calories and macros.",
    "We couldn't save your sleep entry. Your values are still here. Try again.",
    "Delete the Jul 6 weigh-in of 205.8 lb? This will update your trend.",
    "1,840 of 2,300 kcal",
    "4 of 7 days logged",
    "Not logged",
  ];
  for (const s of clean) {
    assert.deepEqual(findBannedCopy(s), [], `false positive on: "${s}"`);
  }
});

/* ------------------------------------------------------ canonical units */

test("canonical formatting matches the approved copy system", () => {
  assert.equal(formatQuantity(2300, "kcal"), "2,300 kcal");
  assert.equal(formatQuantity(190, "g"), "190 g");
  assert.equal(formatQuantity(208.8, "lb"), "208.8 lb");
  assert.equal(formatQuantity(85, "percent"), "85%");
  assert.equal(formatMinutesAsDuration(462), "7h 42m");
  assert.equal(formatMinutesAsDuration(45), "45m");
  assert.equal(formatMinutesAsDuration(480), "8h");
  assert.equal(formatVsTarget(1840, 2300, "kcal"), "1,840 of 2,300 kcal");
  // Durations format on BOTH sides of a vs-target readout.
  assert.equal(formatVsTarget(462, 480, "duration"), "7h 42m of 8h");
});

test("lb/kg conversion round-trips", () => {
  assert.ok(Math.abs(kgToLb(lbToKg(205)) - 205) < 1e-9);
  assert.ok(Math.abs(kgToLb(100) - 220.462) < 0.001);
});

/* ----------------------------------------------------------- fixtures */

/** Per-domain sparse thresholds come from the contract, never test-local. */
const SPARSE_POINTS = Object.fromEntries(
  LOGGABLE_DOMAINS.map((d) => [d.domain, d.sparseBelowPoints])
) as Record<(typeof LOGGABLE_DOMAINS)[number]["domain"], number>;

/** The member-local calendar-day anchor (ms) an instant belongs to. */
function localDayMs(d: Date): number {
  return calendarDayAnchorInTz(d, FIXTURE_TIMEZONE).getTime();
}

test("fixture day math is member-local, not UTC", () => {
  // 03:00 UTC on Jul 8 is 10pm on Jul 7 in Chicago: it belongs to Jul 7.
  assert.equal(
    localDayMs(new Date("2026-07-08T03:00:00.000Z")),
    Date.UTC(2026, 6, 7)
  );
  // 22:30 UTC on Jul 8 (the fixture NOW, 5:30pm CDT) belongs to Jul 8.
  assert.equal(
    localDayMs(new Date("2026-07-08T22:30:00.000Z")),
    Date.UTC(2026, 6, 8)
  );
});

/** Derive the five domain panel states for a persona through the contracts. */
function derivePanelStates(p: Persona): PersonaExpectations {
  const locked = p.tier === "basic";
  const today = fixtureDayAnchorMs(0);

  const mealsToday = p.meals.filter(
    (m) => localDayMs(m.recordedAt) === today
  );
  const nutrition = resolvePanelState({
    locked,
    fetch: "ready",
    reading: readingFromRows(
      mealsToday,
      (rows) => rows.reduce((a, m) => a + m.calories, 0),
      fixtureCoverage(
        mealsToday.map(() => 0),
        1
      )
    ),
    staleAfterDays: METRICS["nutrition.calories.today"].staleAfterDays,
    sparseBelow: { points: SPARSE_POINTS.nutrition },
  });

  const waterToday = p.waterDaily.filter((w) => w.t === today);
  const hydration = resolvePanelState({
    locked,
    fetch: "ready",
    reading: readingFromRows(
      waterToday,
      (rows) => rows.reduce((a, w) => a + w.ml, 0),
      fixtureCoverage(
        waterToday.map(() => 0),
        1
      )
    ),
    staleAfterDays: METRICS["hydration.water.today"].staleAfterDays,
    sparseBelow: { points: SPARSE_POINTS.hydration },
  });

  const nightOffsets = p.sleepDaily.map((s) =>
    Math.round((today - s.t) / DAY_MS)
  );
  const latestNight = [...p.sleepDaily].sort((a, b) => b.t - a.t)[0];
  const sleep = resolvePanelState({
    locked,
    fetch: "ready",
    reading: latestNight
      ? loggedReading(latestNight.minutes, {
          coverage: fixtureCoverage(nightOffsets, 7, p.sleepDaily.length),
          ageDays: Math.round((today - latestNight.t) / DAY_MS),
        })
      : unloggedReading(),
    staleAfterDays: METRICS["sleep.lastNight.duration"].staleAfterDays,
    sparseBelow: { points: SPARSE_POINTS.sleep },
  });

  const workoutDayOffsets = p.workouts.map((w) =>
    Math.round((today - localDayMs(new Date(w.performedAt))) / DAY_MS)
  );
  const training = resolvePanelState({
    locked,
    fetch: "ready",
    reading:
      p.workouts.length > 0
        ? loggedReading(p.workouts.length, {
            coverage: fixtureCoverage(
              workoutDayOffsets,
              28,
              p.workouts.length
            ),
            ageDays: Math.min(...workoutDayOffsets),
          })
        : unloggedReading(),
    staleAfterDays: METRICS["training.session.volume"].staleAfterDays,
    sparseBelow: { points: SPARSE_POINTS.training },
  });

  const latestWeighIn = [...p.weighIns].sort((a, b) => b.t - a.t)[0];
  const body = resolvePanelState({
    locked,
    fetch: "ready",
    reading: latestWeighIn
      ? loggedReading(latestWeighIn.weight, {
          coverage: fixtureCoverage(
            p.weighIns.map((w) => Math.round((today - w.t) / DAY_MS)),
            42,
            p.weighIns.length
          ),
          estimated: false,
          ageDays: Math.round((today - latestWeighIn.t) / DAY_MS),
        })
      : unloggedReading(),
    staleAfterDays: METRICS["body.weight.scale"].staleAfterDays,
    sparseBelow: { points: SPARSE_POINTS.body },
  });

  return { nutrition, hydration, sleep, training, body };
}

test("every persona resolves to its declared panel states", () => {
  for (const p of PERSONAS) {
    assert.deepEqual(
      derivePanelStates(p),
      p.expected,
      `persona ${p.id} state mismatch`
    );
  }
});

test("the consistent persona unlocks trend, rate, and eta on weight", () => {
  const p = PERSONAS.find((x) => x.id === "consistent");
  assert.ok(p);
  const today = fixtureDayAnchorMs(0);
  const coverage = fixtureCoverage(
    p.weighIns.map((w) => Math.round((today - w.t) / DAY_MS)),
    28,
    p.weighIns.length
  );
  assert.equal(canClaim("trend-direction", coverage).allowed, true);
  assert.equal(canClaim("rate", coverage).allowed, true);
  assert.equal(canClaim("eta", coverage).allowed, true);
});

test("the overshoot persona's trend weight reads reached via the shared calc", () => {
  const p = PERSONAS.find((x) => x.id === "overshoot");
  assert.ok(p?.goal);
  const points = [...p.weighIns]
    .sort((a, b) => a.t - b.t)
    .map((w) => ({ t: w.t, weight: w.weight }));
  const trend = ema(points).at(-1)?.trend;
  assert.ok(trend != null);
  assert.equal(isGoalReached(p.goal.startValue, p.goal.targetValue, trend), true);
});

test("fixture workouts exclude warmups from volume, like the live stats", () => {
  const p = PERSONAS.find((x) => x.id === "sparse");
  assert.ok(p);
  const w = p.workouts[0];
  // Two working bench sets of 185x5 plus one row set of 157x8; warmup excluded.
  assert.equal(workoutVolumeLb(w), 185 * 5 * 2 + 157 * 8);
});

test("fixtures are fully deterministic (no wall-clock dependence)", () => {
  // Re-importing produces identical instants; spot-check the anchor math.
  assert.equal(fixtureDayAnchorMs(0), Date.UTC(2026, 6, 8));
  assert.equal(
    fixtureDayAnchorMs(7),
    Date.UTC(2026, 6, 1)
  );
  const ids = PERSONAS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

/* ------------------------------------------------- registry completeness */

test("every loggable-domain metric surface includes /today", () => {
  // The dashboard's daily loggers must render registered metrics.
  const mustBeOnToday: MetricId[] = [
    "nutrition.calories.today",
    "hydration.water.today",
    "sleep.lastNight.duration",
    "training.sessions.thisWeek",
    "body.weight.trend",
  ];
  for (const id of mustBeOnToday) {
    assert.ok(
      (METRICS[id].surfaces as readonly string[]).includes("/today"),
      `${id} missing /today surface`
    );
  }
});

test("evaluation windows are pinned per metric (cross-surface agreement)", () => {
  // Two surfaces reading the same metric must use the same window, so a
  // claim can never be allowed on one page and denied on another.
  assert.equal(coverageWindowDays("nutrition.calories.today"), 7);
  assert.equal(coverageWindowDays("body.weight.trend"), 28);
  assert.equal(coverageWindowDays("training.session.volume"), 28);
  assert.equal(coverageWindowDays("sleep.week.nightly"), 7);
});
