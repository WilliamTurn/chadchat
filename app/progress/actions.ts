"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { canAccessProFeatures } from "@/lib/admin";
import { buildMontageVerdict, type PhotoEntry } from "@/lib/ai/montage";
import { parseCalendarDay } from "@/lib/date";
import { applyMutationReceipt } from "@/lib/refresh/coordinator";
import { loggingReceipt } from "@/lib/refresh/receipt";
import {
  createBodyMeasurement,
  createProgressEntry,
  createProgressMontage,
  deleteBodyMeasurement,
  deleteProgressEntry,
  getProgressEntriesByUserId,
  getUserById,
  updateProgressEntry,
} from "@/lib/db/queries";
import type { ProgressMontageContent } from "@/lib/montage/content";
import { checkMontageAllowance } from "@/lib/montage/limit";
import {
  type BodyMeasurementInput,
  bodyMeasurementSchema,
  type EditProgressEntryInput,
  editProgressEntrySchema,
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
  if (!(user && canAccessProFeatures(user))) {
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
  const recorded = parseCalendarDay(recordedAt) ?? new Date();

  await createProgressEntry({
    userId: user.id,
    recordedAt: recorded,
    weight: weight ?? null,
    unit,
    photoUrl: photoUrl ?? null,
    note: note?.trim() ? note.trim() : null,
  });

  applyMutationReceipt(
    loggingReceipt({
      domain: "body",
      entity: "progressEntry",
      op: "create",
      days: recordedAt ? { startISO: recordedAt } : undefined,
    })
  );
  return { ok: true };
}

export async function editProgressEntry(
  input: EditProgressEntryInput
): Promise<ProgressActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "The progress dashboard is a Chad Pro feature." };
  }

  const parsed = editProgressEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't update that entry.",
    };
  }

  const { id, recordedAt, weight, unit, note } = parsed.data;
  const recorded = parseCalendarDay(recordedAt) ?? new Date();

  await updateProgressEntry({
    id,
    userId: user.id,
    recordedAt: recorded,
    weight: weight ?? null,
    unit,
    note: note?.trim() ? note.trim() : null,
  });

  applyMutationReceipt(
    loggingReceipt({
      domain: "body",
      entity: "progressEntry",
      op: "update",
      days: recordedAt ? { startISO: recordedAt } : undefined,
    })
  );
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
  applyMutationReceipt(
    loggingReceipt({ domain: "body", entity: "progressEntry", op: "delete" })
  );
  return { ok: true };
}

export async function addBodyMeasurement(
  input: BodyMeasurementInput
): Promise<ProgressActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "The progress dashboard is a Chad Pro feature." };
  }

  const parsed = bodyMeasurementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save that measurement.",
    };
  }

  const { recordedAt, kind, value, unit } = parsed.data;
  const recorded = parseCalendarDay(recordedAt) ?? new Date();

  await createBodyMeasurement({
    userId: user.id,
    recordedAt: recorded,
    kind,
    value,
    unit,
  });

  applyMutationReceipt(
    loggingReceipt({
      domain: "body",
      entity: "bodyMeasurement",
      op: "create",
      days: recordedAt ? { startISO: recordedAt } : undefined,
    })
  );
  return { ok: true };
}

export async function removeBodyMeasurement(
  id: string
): Promise<ProgressActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }

  await deleteBodyMeasurement({ id, userId: user.id });
  applyMutationReceipt(
    loggingReceipt({ domain: "body", entity: "bodyMeasurement", op: "delete" })
  );
  return { ok: true };
}

export type MontageActionResult =
  | { ok: true; content: ProgressMontageContent }
  | { ok: false; error: string };

/**
 * Build a fresh progress-photo montage (FEAT-18): Chad's vision read over the
 * member's real photos. Text only comes back from the model — the composite
 * image is drawn client-side from the same real photos, never generated.
 * Fair-use capped (lib/montage/limit.ts) like every expensive generator.
 */
export async function generateMontage(): Promise<MontageActionResult> {
  const user = await requirePro();
  if (!user) {
    return {
      ok: false,
      error: "The progress dashboard is a Chad Pro feature.",
    };
  }

  const allowance = await checkMontageAllowance(user.id);
  if (!allowance.allowed) {
    return { ok: false, error: allowance.message };
  }

  const entries = await getProgressEntriesByUserId(user.id);
  const photos = entries.filter((e): e is PhotoEntry => e.photoUrl != null);
  if (photos.length < 2) {
    return {
      ok: false,
      error:
        "Chad needs at least two progress photos to build a montage. Log another photo first.",
    };
  }

  try {
    const content = await buildMontageVerdict(user, photos);
    await createProgressMontage({ userId: user.id, content });
    revalidatePath("/progress");
    return { ok: true, content };
  } catch (_error) {
    return {
      ok: false,
      error: "Chad couldn't build the montage just now. Try again in a minute.",
    };
  }
}
