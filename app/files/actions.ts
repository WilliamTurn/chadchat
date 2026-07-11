"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import {
  deleteDocumentFully,
  deleteUserUpload,
  getDocumentById,
  renameDocument,
} from "@/lib/db/queries";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function renameDocumentAction({
  id,
  title,
}: {
  id: string;
  title: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Please sign in again." };
  }

  const trimmed = title.trim();
  if (!trimmed) {
    return { ok: false, error: "The name can't be empty." };
  }
  if (trimmed.length > 120) {
    return { ok: false, error: "Keep the name under 120 characters." };
  }

  const document = await getDocumentById({ id });
  if (!document || document.userId !== session.user.id) {
    return { ok: false, error: "That document no longer exists." };
  }

  await renameDocument({ id, userId: session.user.id, title: trimmed });
  revalidatePath("/files");
  revalidatePath(`/files/${id}`);
  return { ok: true };
}

export async function deleteDocumentAction({
  id,
}: {
  id: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Please sign in again." };
  }

  const document = await getDocumentById({ id });
  if (!document || document.userId !== session.user.id) {
    return { ok: false, error: "That document no longer exists." };
  }

  await deleteDocumentFully({ id, userId: session.user.id });
  revalidatePath("/files");
  return { ok: true };
}

export async function deleteUploadAction({
  id,
}: {
  id: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Please sign in again." };
  }

  const [deleted] = await deleteUserUpload({ id, userId: session.user.id });
  if (!deleted) {
    return { ok: false, error: "That photo no longer exists." };
  }

  // Remove the blob too so deleted photos don't live on at their URL. Best
  // effort: the library row is already gone, which is what the member sees.
  try {
    await del(deleted.url);
  } catch (error) {
    console.error("[files] Failed to delete blob:", error);
  }

  revalidatePath("/files");
  return { ok: true };
}
