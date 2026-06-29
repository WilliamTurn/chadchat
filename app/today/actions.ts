"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { parseCalendarDay } from "@/lib/date";
import {
  createGoal,
  createPlan,
  createSleepEntry,
  deleteGoal,
  deletePlan,
  getUserById,
  getUserMemory,
  updateGoal,
  updatePlan,
  updateUserHero,
  upsertUserMemory,
} from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { type SleepEntryInput, sleepEntrySchema } from "@/lib/validation/sleep";
import {
  type CreateGoalInput,
  createGoalSchema,
  type CreatePlanInput,
  createPlanSchema,
  type UpdateGoalInput,
  updateGoalSchema,
  type UpdatePlanInput,
  updatePlanSchema,
} from "@/lib/validation/goals";
import { saveGoalSchema, type SaveGoalInput } from "@/lib/validation/today";

export type TodayActionState = { ok: boolean; error?: string };

/** Shared gate: the signed-in user, only if they can access Chad. */
async function requireChadUser(): Promise<
  { user: User } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not signed in." };
  }
  const user = await getUserById(session.user.id);
  if (!(user && canAccessChad(user))) {
    return { error: "Not authorized." };
  }
  return { user };
}

// The fields Chad's memory "## Client file" block tracks, in order. Mirrors the
// template in lib/ai/memory.ts so a user-set goal lands in the same structure
// Chad reads and the background memory updater merges into.
const CLIENT_FILE_FIELDS = [
  "Name",
  "Age",
  "Sex",
  "Height",
  "Weight",
  "Current physique",
  "Family / dependents",
  "Primary goal",
  "Target / deadline",
  "Training experience",
  "Equipment / gym access",
  "Weekly schedule",
  "Injuries / medical constraints",
  "Dietary restrictions / preferences",
  "Current workout plan",
  "Current diet plan",
  "Week / phase",
] as const;

function freshScaffold(): string {
  const lines = CLIENT_FILE_FIELDS.map((f) => `- ${f}: Unknown`).join("\n");
  return `## Client file\n${lines}\n\n## Notes\n`;
}

/** Set (or create) one "- Label: value" line in the profile markdown. */
function setClientField(profile: string, label: string, value: string): string {
  const safe = value.trim() || "Unknown";
  const escaped = label.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const lineRe = new RegExp(`^([-*]\\s*${escaped}\\s*:\\s*).*$`, "im");
  if (lineRe.test(profile)) {
    return profile.replace(lineRe, `$1${safe}`);
  }
  const headerRe = /^(##\s*Client file.*)$/im;
  if (headerRe.test(profile)) {
    return profile.replace(headerRe, `$1\n- ${label}: ${safe}`);
  }
  return `${profile}\n- ${label}: ${safe}`;
}

export async function saveGoal(
  input: SaveGoalInput
): Promise<TodayActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Not signed in." };
  }
  const user = await getUserById(session.user.id);
  if (!(user && canAccessChad(user))) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = saveGoalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save that.",
    };
  }
  const { goal, deadline, phase } = parsed.data;

  const existing = await getUserMemory(user.id);
  let profile = existing?.profile?.trim() || freshScaffold();
  profile = setClientField(profile, "Primary goal", goal);
  profile = setClientField(profile, "Target / deadline", deadline ?? "");
  profile = setClientField(profile, "Week / phase", phase ?? "");

  await upsertUserMemory(user.id, profile);
  revalidatePath("/today");
  return { ok: true };
}

// --- Structured goal/plan records (the full documents, not the memory summary) ---

export async function saveGoalRecord(
  input: CreateGoalInput
): Promise<TodayActionState> {
  const gate = await requireChadUser();
  if ("error" in gate) {
    return { ok: false, error: gate.error };
  }
  const parsed = createGoalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save that.",
    };
  }
  const d = parsed.data;
  await createGoal({
    userId: gate.user.id,
    title: d.title,
    detail: d.detail,
    targetDate: d.targetDate ?? null,
    status: d.status,
    source: "user",
    sourceChatId: null,
    metric: d.metric ?? null,
    startValue: d.startValue ?? null,
    targetValue: d.targetValue ?? null,
    unit: d.unit ?? null,
  });
  revalidatePath("/today");
  return { ok: true };
}

export async function updateGoalRecord(
  input: UpdateGoalInput
): Promise<TodayActionState> {
  const gate = await requireChadUser();
  if ("error" in gate) {
    return { ok: false, error: gate.error };
  }
  const parsed = updateGoalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save that.",
    };
  }
  const d = parsed.data;
  await updateGoal({
    id: d.id,
    userId: gate.user.id,
    title: d.title,
    detail: d.detail,
    targetDate: d.targetDate ?? null,
    status: d.status,
    metric: d.metric ?? null,
    startValue: d.startValue ?? null,
    targetValue: d.targetValue ?? null,
    unit: d.unit ?? null,
  });
  revalidatePath("/today");
  return { ok: true };
}

export async function removeGoal(id: string): Promise<TodayActionState> {
  const gate = await requireChadUser();
  if ("error" in gate) {
    return { ok: false, error: gate.error };
  }
  await deleteGoal({ id, userId: gate.user.id });
  revalidatePath("/today");
  return { ok: true };
}

export async function savePlanRecord(
  input: CreatePlanInput
): Promise<TodayActionState> {
  const gate = await requireChadUser();
  if ("error" in gate) {
    return { ok: false, error: gate.error };
  }
  const parsed = createPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save that.",
    };
  }
  const d = parsed.data;
  await createPlan({
    userId: gate.user.id,
    title: d.title,
    detail: d.detail,
    kind: d.kind,
    status: d.status,
    source: "user",
    sourceChatId: null,
  });
  revalidatePath("/today");
  return { ok: true };
}

export async function updatePlanRecord(
  input: UpdatePlanInput
): Promise<TodayActionState> {
  const gate = await requireChadUser();
  if ("error" in gate) {
    return { ok: false, error: gate.error };
  }
  const parsed = updatePlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save that.",
    };
  }
  const d = parsed.data;
  await updatePlan({
    id: d.id,
    userId: gate.user.id,
    title: d.title,
    detail: d.detail,
    kind: d.kind,
    status: d.status,
  });
  revalidatePath("/today");
  return { ok: true };
}

export async function removePlan(id: string): Promise<TodayActionState> {
  const gate = await requireChadUser();
  if ("error" in gate) {
    return { ok: false, error: gate.error };
  }
  await deletePlan({ id, userId: gate.user.id });
  revalidatePath("/today");
  return { ok: true };
}

// --- Sleep & recovery (Pro) ---

/** Log (or overwrite) a night's sleep for the Sleep & Recovery card. */
export async function logSleep(
  input: SleepEntryInput
): Promise<TodayActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Not signed in." };
  }
  const user = await getUserById(session.user.id);
  if (!(user && canAccessProFeatures(user))) {
    return { ok: false, error: "Sleep tracking is a Chad Pro feature." };
  }

  const parsed = sleepEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't log that.",
    };
  }

  const { recordedAt, minutes, quality } = parsed.data;
  await createSleepEntry({
    userId: user.id,
    recordedAt: parseCalendarDay(recordedAt) ?? new Date(),
    minutes,
    quality: quality ?? null,
  });

  revalidatePath("/today");
  return { ok: true };
}

// --- /today hero figure (DSH-21) ---

/** Switch the decorative /today header figure to a built-in silhouette. */
export async function setHeroFigure(
  figure: "male" | "female"
): Promise<TodayActionState> {
  const gate = await requireChadUser();
  if ("error" in gate) {
    return { ok: false, error: gate.error };
  }
  if (figure !== "male" && figure !== "female") {
    return { ok: false, error: "Unknown figure." };
  }
  await updateUserHero(gate.user.id, { heroFigure: figure });
  revalidatePath("/today");
  return { ok: true };
}

/** Clear the choice so the header falls back to the gender-derived default. */
export async function resetHeroFigure(): Promise<TodayActionState> {
  const gate = await requireChadUser();
  if ("error" in gate) {
    return { ok: false, error: gate.error };
  }
  await updateUserHero(gate.user.id, { heroFigure: null });
  revalidatePath("/today");
  return { ok: true };
}

const MAX_HERO_BYTES = 5 * 1024 * 1024;
const HERO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Upload a custom background image for the /today header and select it. */
export async function uploadHeroImage(
  formData: FormData
): Promise<TodayActionState> {
  const gate = await requireChadUser();
  if ("error" in gate) {
    return { ok: false, error: gate.error };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No image selected." };
  }
  if (file.size > MAX_HERO_BYTES) {
    return { ok: false, error: "Image must be under 5MB." };
  }
  if (!HERO_TYPES.has(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, or WebP image." };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      ok: false,
      error: "Image storage isn't set up yet. Try again shortly.",
    };
  }

  try {
    const buffer = await file.arrayBuffer();
    const safeName = (file.name || "hero").replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(`hero/${gate.user.id}/${safeName}`, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    await updateUserHero(gate.user.id, {
      heroFigure: "custom",
      heroImageUrl: blob.url,
    });
  } catch (_error) {
    return { ok: false, error: "Couldn't save that image. Try again." };
  }

  revalidatePath("/today");
  return { ok: true };
}
