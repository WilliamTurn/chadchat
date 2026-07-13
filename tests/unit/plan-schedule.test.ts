/**
 * Structured-plan schedule tests (FIX-28 / DEC-06). The invariants: the
 * legacy days json resolves to the SAME typed schedule the tables carry,
 * prescriptions round-trip losslessly back to the logger's PlanDay shape
 * (raw source preserved), and the set-level expansion is conservative
 * (unparseable rep strings stay null, never invented numbers).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPlanDays } from "../../lib/plans/materialize";
import {
  expandSetPrescriptions,
  parseRepPrescription,
  planSessionsPerWeek,
  scheduleFromPlanDays,
  sessionToPlanDay,
} from "../../lib/plans/schedule";
import type { PlanDay } from "../../lib/validation/plan-days";

const FOUR_DAY_SPLIT: PlanDay[] = [
  {
    name: "Day 1: Upper",
    exercises: [
      {
        name: "Barbell Bench Press",
        sets: 4,
        reps: "4-6",
        weight: 185,
        unit: "lb",
        note: "RPE 8",
      },
      { name: "Barbell Row", sets: 4, reps: "8-12", weight: null, unit: "lb" },
    ],
  },
  {
    name: "Day 2: Lower",
    exercises: [
      { name: "Back Squat", sets: 5, reps: "5", weight: 225, unit: "lb" },
      { name: "Plank", sets: 3, reps: "45s", weight: null, unit: "lb" },
    ],
  },
  {
    name: "Day 3: Push",
    exercises: [
      {
        name: "Overhead Press",
        sets: 3,
        reps: "AMRAP",
        weight: null,
        unit: "lb",
      },
    ],
  },
  {
    name: "Day 4: Pull",
    exercises: [
      {
        name: "Dumbbell Curl",
        sets: 3,
        reps: "10 per side",
        weight: 30,
        unit: "lb",
      },
    ],
  },
];

describe("parseRepPrescription", () => {
  it("reads fixed reps", () => {
    assert.deepEqual(parseRepPrescription("8"), {
      reps: 8,
      repRangeStart: null,
      repRangeEnd: null,
      durationSeconds: null,
    });
  });

  it("reads rep ranges with or without spaces", () => {
    assert.deepEqual(parseRepPrescription("4-6").repRangeStart, 4);
    assert.deepEqual(parseRepPrescription("4-6").repRangeEnd, 6);
    assert.deepEqual(parseRepPrescription("8 - 12").repRangeStart, 8);
  });

  it("reads timed prescriptions in the logger's suffix grammar", () => {
    assert.equal(parseRepPrescription("45s").durationSeconds, 45);
    assert.equal(parseRepPrescription("90 sec").durationSeconds, 90);
    assert.equal(parseRepPrescription("60 seconds").durationSeconds, 60);
  });

  it("stays null on anything it cannot read (never invents numbers)", () => {
    for (const raw of ["AMRAP", "5 per side", "to failure", ""]) {
      const parsed = parseRepPrescription(raw);
      assert.equal(parsed.reps, null, raw);
      assert.equal(parsed.repRangeStart, null, raw);
      assert.equal(parsed.durationSeconds, null, raw);
    }
  });
});

describe("expandSetPrescriptions", () => {
  it("expands '4 x 8-12 @ 185' into four normal set rows", () => {
    const rows = expandSetPrescriptions({ sets: 4, reps: "8-12", weight: 185 });
    assert.equal(rows.length, 4);
    for (const [i, row] of rows.entries()) {
      assert.equal(row.position, i);
      assert.equal(row.type, "normal");
      assert.equal(row.repRangeStart, 8);
      assert.equal(row.repRangeEnd, 12);
      assert.equal(row.weight, 185);
      assert.equal(row.reps, null);
    }
  });
});

describe("scheduleFromPlanDays", () => {
  it("resolves the legacy days json to the typed schedule", () => {
    const schedule = scheduleFromPlanDays("plan-1", FOUR_DAY_SPLIT);
    assert.equal(schedule.planId, "plan-1");
    assert.equal(schedule.sessions.length, 4);
    assert.deepEqual(
      schedule.sessions.map((s) => s.position),
      [0, 1, 2, 3]
    );
    // Legacy view carries no materialized ids and no weekday pins.
    assert.ok(schedule.sessions.every((s) => s.id === null));
    assert.ok(schedule.sessions.every((s) => s.weekday === null));
    // Set-level expansion rode along.
    const bench = schedule.sessions[0].exercises[0];
    assert.equal(bench.setPrescriptions.length, 4);
    assert.equal(bench.setPrescriptions[0].repRangeStart, 4);
  });

  it("round-trips every session back to the logger's PlanDay shape losslessly (DEC-06)", () => {
    const schedule = scheduleFromPlanDays("plan-1", FOUR_DAY_SPLIT);
    const roundTripped = schedule.sessions.map(sessionToPlanDay);
    const normalized = FOUR_DAY_SPLIT.map((day) => ({
      name: day.name,
      exercises: day.exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight ?? null,
        unit: ex.unit ?? "lb",
        note: ex.note ?? null,
      })),
    }));
    assert.deepEqual(roundTripped, normalized);
  });

  it("counts sessions per week for the plan target (metrics.ts plan kind)", () => {
    assert.equal(
      planSessionsPerWeek(scheduleFromPlanDays("p", FOUR_DAY_SPLIT)),
      4
    );
  });
});

describe("hashPlanDays", () => {
  it("is stable for equal input and changes when the plan changes", () => {
    const a = hashPlanDays(FOUR_DAY_SPLIT);
    const b = hashPlanDays(JSON.parse(JSON.stringify(FOUR_DAY_SPLIT)));
    assert.equal(a, b);
    const edited = JSON.parse(JSON.stringify(FOUR_DAY_SPLIT)) as PlanDay[];
    edited[0].exercises[0].sets = 5;
    assert.notEqual(hashPlanDays(edited), a);
  });
});
