"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { canAccessChad } from "@/lib/admin";
import { getUserById, getUserMemory, upsertUserMemory } from "@/lib/db/queries";
import { saveGoalSchema, type SaveGoalInput } from "@/lib/validation/today";

export type TodayActionState = { ok: boolean; error?: string };

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
