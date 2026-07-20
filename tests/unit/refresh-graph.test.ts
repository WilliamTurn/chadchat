/**
 * Refresh-graph tests (FIX-10 / DSH-66 P4). The invariant: dependent surfaces
 * are DERIVED from the contracts (metric registry surfaces + route domains),
 * and the derived fan-out is a SUPERSET of every hardcoded revalidatePath
 * list it replaced, so no surface that used to refresh stops refreshing.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RouteId } from "../../lib/contracts/routes";
import {
  loggingReceipt,
  mutationReceipt,
  surfacesForDomains,
  surfacesForReceipt,
  targetReceipt,
} from "../../lib/refresh/receipt";

function assertCovers(actual: RouteId[], required: RouteId[], label: string) {
  for (const r of required) {
    assert.ok(actual.includes(r), `${label}: missing ${r} in [${actual}]`);
  }
}

describe("surfacesForDomains", () => {
  it("nutrition spans every surface its metrics render on", () => {
    assertCovers(
      surfacesForDomains(["nutrition"]),
      ["/home", "/nutrition", "/reports"],
      "nutrition"
    );
  });

  it("body mutations reach /home, /goals, and /reports, not just /progress (the pre-FIX-10 bug)", () => {
    assertCovers(
      surfacesForDomains(["body"]),
      ["/home", "/progress", "/goals", "/reports"],
      "body"
    );
  });

  it("training spans the workout routes and the dashboards", () => {
    assertCovers(
      surfacesForDomains(["training"]),
      ["/home", "/workouts", "/workouts/history", "/goals"],
      "training"
    );
  });

  it("engagement adds the Today dashboard", () => {
    assertCovers(surfacesForDomains(["engagement"]), ["/home"], "engagement");
  });
});

describe("receipts cover every legacy hardcoded revalidate list", () => {
  const LEGACY: {
    label: string;
    receipt: Parameters<typeof surfacesForReceipt>[0];
    old: RouteId[];
  }[] = [
    {
      label: "meal log (app/nutrition analyzeMeal/logMealManually)",
      receipt: loggingReceipt({
        domain: "nutrition",
        entity: "meal",
        op: "create",
        alsoDomains: ["kitchen"],
      }),
      old: ["/nutrition", "/kitchen", "/home"],
    },
    {
      label: "water log (logWaterAmount/removeWater)",
      receipt: loggingReceipt({
        domain: "hydration",
        entity: "waterLog",
        op: "create",
      }),
      old: ["/home", "/hydration"],
    },
    {
      label: "water goal (saveWaterGoal)",
      receipt: targetReceipt({ domain: "hydration", entity: "waterGoal" }),
      old: ["/home", "/hydration"],
    },
    {
      label: "nutrition target (saveNutritionTarget/applyRecalibration)",
      receipt: targetReceipt({ domain: "nutrition", entity: "nutritionTarget" }),
      old: ["/nutrition", "/home"],
    },
    {
      label: "sleep entry (logSleep/removeSleep)",
      receipt: loggingReceipt({
        domain: "sleep",
        entity: "sleepEntry",
        op: "create",
      }),
      old: ["/home", "/sleep"],
    },
    {
      label: "sleep goal (saveSleepGoal)",
      receipt: targetReceipt({ domain: "sleep", entity: "sleepGoal" }),
      old: ["/home", "/sleep"],
    },
    {
      label: "weigh-in / measurement (app/progress)",
      receipt: loggingReceipt({
        domain: "body",
        entity: "progressEntry",
        op: "create",
      }),
      old: ["/progress"],
    },
    {
      label: "workout save/delete (app/workouts)",
      receipt: loggingReceipt({
        domain: "training",
        entity: "workout",
        op: "create",
      }),
      old: ["/workouts", "/workouts/history", "/home"],
    },
    {
      label: "custom exercise (revalidateExercisePages)",
      receipt: mutationReceipt({
        domain: "training",
        entity: "customExercise",
        op: "update",
      }),
      old: ["/workouts", "/workouts/exercises", "/workouts/exercises/pick"],
    },
    {
      label: "goal record (app/home saveGoalRecord/removeGoal)",
      receipt: mutationReceipt({ domain: "goals", entity: "goal", op: "create" }),
      old: ["/home"],
    },
    {
      label: "plan record (app/home savePlanRecord/removePlan)",
      receipt: mutationReceipt({
        domain: "plans",
        entity: "plan",
        op: "create",
        alsoSurfaces: ["/home"],
      }),
      old: ["/home"],
    },
    {
      label: "meal plan build (app/meal-plan generatePlan)",
      receipt: mutationReceipt({
        domain: "plans",
        entity: "mealPlan",
        op: "create",
        alsoDomains: ["nutrition"],
        alsoSurfaces: ["/home"],
      }),
      old: ["/meal-plan", "/home", "/nutrition"],
    },
  ];

  for (const { label, receipt, old } of LEGACY) {
    it(label, () => {
      assertCovers(surfacesForReceipt(receipt), old, label);
    });
  }
});

describe("receipt semantics", () => {
  it("loggingReceipt always carries engagement (streak/consistency count every log)", () => {
    const r = loggingReceipt({
      domain: "sleep",
      entity: "sleepEntry",
      op: "create",
    });
    assert.ok(r.domains.includes("engagement"));
  });

  it("targetReceipt days are forward-open from today (the FIX-07 model)", () => {
    const r = targetReceipt({
      domain: "nutrition",
      entity: "nutritionTarget",
      todayISO: "2026-07-13",
    });
    assert.deepEqual(r.days, { startISO: "2026-07-13" });
    assert.equal(r.days?.endISO, undefined);
  });

  it("alsoSurfaces are unioned in, never replacing the derived set", () => {
    const r = mutationReceipt({
      domain: "plans",
      entity: "plan",
      op: "create",
      alsoSurfaces: ["/home"],
    });
    const surfaces = surfacesForReceipt(r);
    assert.ok(surfaces.includes("/home"));
    assert.ok(surfaces.includes("/plans/[id]"));
  });
});
