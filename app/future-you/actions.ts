"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { canAccessProFeatures } from "@/lib/admin";
import {
  createFutureYouForecast,
  getGoalById,
  getLatestFutureYouForecast,
  getProgressEntriesByUserId,
  getUserById,
} from "@/lib/db/queries";
import {
  type FutureYouContent,
  parseFutureYouContent,
} from "@/lib/future-you/content";
import { runForecastPipeline } from "@/lib/future-you/generate";
import { checkForecastAllowance } from "@/lib/future-you/limit";
import { buildMilestonePlan } from "@/lib/future-you/milestones";
import { checkPhotoSet, MAX_PHOTOS, MIN_PHOTOS } from "@/lib/future-you/qc";
import { trendWeightInUnit } from "@/lib/goals/latest-weight";

/**
 * Server actions for Future You (FEAT-29). startForecast runs the photo QC
 * inline (fail fast, before any image dollars), creates the pending row, and
 * kicks the generation pipeline off in the background via after(), the page
 * then polls getLatestForecast until the row resolves.
 */

// A pending row older than this is treated as dead (the background run was
// killed mid-flight); the member sees the failure and can retry. Sized past
// the 800s function ceiling plus QC.
const STALE_PENDING_MS = 16 * 60 * 1000;

/** The client-safe shape of a forecast row. */
export type ForecastView = {
  id: string;
  status: "pending" | "ready" | "failed";
  content: FutureYouContent | null;
  error: string | null;
  sourcePhotoUrls: string[];
  createdAtLabel: string;
};

export type StartForecastResult =
  | { ok: true; forecast: ForecastView }
  | { ok: false; error: string };

async function requirePro() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const user = await getUserById(session.user.id);
  if (!(user && canAccessProFeatures(user))) {
    return null;
  }
  return user;
}

const startInputSchema = z.object({
  goalId: z.string().uuid(),
  photoUrls: z
    .array(
      z
        .string()
        .url()
        .refine(
          (url) => {
            try {
              return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
            } catch {
              return false;
            }
          },
          { message: "Photos must be uploaded through the app." }
        )
    )
    .min(MIN_PHOTOS, `Chad needs at least ${MIN_PHOTOS} photos.`)
    .max(MAX_PHOTOS, `${MAX_PHOTOS} photos is the maximum.`),
});

function toView(forecast: {
  id: string;
  status: string;
  content: unknown;
  error: string | null;
  sourcePhotoUrls: string[];
  createdAt: Date;
}): ForecastView {
  const status =
    forecast.status === "pending" &&
    Date.now() - forecast.createdAt.getTime() > STALE_PENDING_MS
      ? "failed"
      : (forecast.status as ForecastView["status"]);
  return {
    id: forecast.id,
    status,
    content: forecast.content ? parseFutureYouContent(forecast.content) : null,
    error:
      status === "failed"
        ? (forecast.error ??
          "Chad couldn't finish your forecast this time. Hit Generate again.")
        : forecast.error,
    sourcePhotoUrls: forecast.sourcePhotoUrls,
    createdAtLabel: forecast.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export async function startForecast(input: {
  goalId: string;
  photoUrls: string[];
}): Promise<StartForecastResult> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Future You is a Chad Pro feature." };
  }

  const parsed = startInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't start that forecast.",
    };
  }

  const goal = await getGoalById({ id: parsed.data.goalId, userId: user.id });
  if (!goal || goal.status !== "active") {
    return {
      ok: false,
      error: "Chad needs your active goal to project from. Set one first.",
    };
  }

  const allowance = await checkForecastAllowance(user.id);
  if (!allowance.allowed) {
    return { ok: false, error: allowance.message };
  }

  // A run already cooking: don't start a second one under it.
  const existing = await getLatestFutureYouForecast(user.id);
  if (
    existing &&
    existing.status === "pending" &&
    Date.now() - existing.createdAt.getTime() <= STALE_PENDING_MS
  ) {
    return {
      ok: false,
      error: "Your forecast is already being built. Give it a minute.",
    };
  }

  // Photo QC before any image dollars: Chad rejects a weak set with exact
  // reshoot instructions instead of producing a projection that won't look
  // like the member.
  let qc: Awaited<ReturnType<typeof checkPhotoSet>>;
  try {
    qc = await checkPhotoSet(parsed.data.photoUrls);
  } catch (error) {
    console.error("[future-you] photo QC failed:", error);
    return {
      ok: false,
      error: "Chad couldn't read your photos just now. Try again in a minute.",
    };
  }
  if (!qc.acceptable) {
    return { ok: false, error: qc.chadNote };
  }

  // Checkpoint math: anchor on the member's canonical current weight (the
  // smoothed trend, LC-4) converted into the goal's own unit.
  const entries = await getProgressEntriesByUserId(user.id);
  const goalUnit: "lb" | "kg" = (goal.unit ?? "")
    .trim()
    .toLowerCase()
    .startsWith("k")
    ? "kg"
    : "lb";
  // trendWeightInUnit honors the preferred unit we pass, so the value is
  // already in the goal's unit space.
  const currentWeight = trendWeightInUnit(entries, goalUnit)?.value ?? null;
  const plan = buildMilestonePlan({ goal, user, currentWeight });

  const created = await createFutureYouForecast({
    userId: user.id,
    goalId: goal.id,
    sourcePhotoUrls: parsed.data.photoUrls,
  });

  // Fire the pipeline after the response is sent; the page polls the row.
  after(() =>
    runForecastPipeline({
      forecastId: created.id,
      user,
      goal,
      plan,
      photoUrls: parsed.data.photoUrls,
      currentWeightLabel:
        currentWeight != null ? `${currentWeight} ${goalUnit}` : null,
    })
  );

  revalidatePath("/future-you");
  return { ok: true, forecast: toView(created) };
}

/** The page's polling read: the member's latest forecast, client-shaped. */
export async function getLatestForecast(): Promise<ForecastView | null> {
  const user = await requirePro();
  if (!user) {
    return null;
  }
  const latest = await getLatestFutureYouForecast(user.id);
  return latest ? toView(latest) : null;
}
