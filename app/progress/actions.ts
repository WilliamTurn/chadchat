"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { getEntitlements } from "@/lib/ai/entitlements";
import {
  createProgressEntry,
  deleteProgressEntry,
  getUserById,
} from "@/lib/db/queries";
import {
  type ProgressEntryInput,
  progressEntrySchema,
} from "@/lib/validation/progress";

export type ProgressActionState = { ok: boolean; error?: string };

/**
 * Resolve the signed-in user and confirm they have Pro features. The progress
 * dashboard (weight history + photos) is a Chad Pro feature, so this is the
 * server-side gate behind the UI — re-checked on every write.
 */
async function requirePro() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const user = await getUserById(session.user.id);
  if (!(user && getEntitlements(user).photoAnalysis)) {
    return null;
  }
  return user;
}

export async function addProgressEntry(
  input: ProgressEntryInput
): Promise<ProgressActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "The progress dashboard is a Chad Pro feature." };
  }

  const parsed = progressEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save that entry.",
    };
  }

  const { recordedAt, weight, unit, note, photoUrl } = parsed.data;
  const when = recordedAt ? new Date(recordedAt) : new Date();
  const recorded = Number.isNaN(when.getTime()) ? new Date() : when;

  await createProgressEntry({
    userId: user.id,
    recordedAt: recorded,
    weight: weight ?? null,
    unit,
    photoUrl: photoUrl ?? null,
    note: note?.trim() ? note.trim() : null,
  });

  revalidatePath("/progress");
  return { ok: true };
}

export async function removeProgressEntry(
  id: string
): Promise<ProgressActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }

  await deleteProgressEntry({ id, userId: user.id });
  revalidatePath("/progress");
  return { ok: true };
}
