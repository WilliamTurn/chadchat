"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { ADMIN_PATH, isAdminEmail } from "@/lib/admin";
import { clearPanelCookie, isPanelUnlocked } from "@/lib/admin-gate";
import {
  deleteUserByEmail,
  getUserById,
  setManualSubscriptionByEmail,
} from "@/lib/db/queries";
import { PLANS } from "@/lib/stripe";

export type GrantState = {
  status: "idle" | "success" | "error";
  message: string;
};

/**
 * Re-check admin on every privileged action — the page check alone isn't a
 * security boundary. Requires BOTH the email allowlist and the passphrase
 * unlock (NAV-34), so a destructive action can't run without the secret even
 * if the admin's session is valid.
 */
async function assertAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) {
    return false;
  }
  const me = await getUserById(session.user.id);
  if (!isAdminEmail(me?.email)) {
    return false;
  }
  return await isPanelUnlocked();
}

/**
 * Grant (basic/pro) or revoke (none) a user's access by email. Wired to a
 * useActionState form on the dashboard.
 */
export async function grantTierAction(
  _prev: GrantState,
  formData: FormData
): Promise<GrantState> {
  if (!(await assertAdmin())) {
    return { status: "error", message: "Not authorized." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const tierRaw = String(formData.get("tier") ?? "");

  if (!email) {
    return { status: "error", message: "Enter an email address." };
  }

  let tier: "basic" | "pro" | "elite" | null;
  if (tierRaw === "basic" || tierRaw === "pro" || tierRaw === "elite") {
    tier = tierRaw;
  } else if (tierRaw === "none") {
    tier = null;
  } else {
    return { status: "error", message: "Pick a tier." };
  }

  const result = await setManualSubscriptionByEmail(email, tier);

  if (!result.ok) {
    return {
      status: "error",
      message: `No account found for "${email}". They need to sign up first, then grant access.`,
    };
  }

  revalidatePath(ADMIN_PATH);

  if (tier) {
    return {
      status: "success",
      message: `${email} now has ${PLANS[tier].name} access (manual comp — no charge). It takes effect on their next page load.`,
    };
  }
  return {
    status: "success",
    message: `Access revoked for ${email}. Their chat history is kept.`,
  };
}

/**
 * Permanently delete a user by email (their account + all their data). Built
 * for clearing out throwaway test accounts. Requires the confirm checkbox, and
 * refuses to delete an admin account so you can't nuke your own access here.
 */
export async function deleteUserAction(
  _prev: GrantState,
  formData: FormData
): Promise<GrantState> {
  if (!(await assertAdmin())) {
    return { status: "error", message: "Not authorized." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const confirmed = formData.get("confirm") === "on";

  if (!email) {
    return { status: "error", message: "Enter an email address." };
  }

  if (!confirmed) {
    return {
      status: "error",
      message: "Tick the confirm box first — deleting a user is permanent.",
    };
  }

  // Never delete an admin account (including your own) from this tool.
  if (isAdminEmail(email)) {
    return {
      status: "error",
      message:
        "That's an admin account — it can't be deleted from here. Remove it from the database directly if you really mean to.",
    };
  }

  const result = await deleteUserByEmail(email);

  if (!result.ok) {
    return {
      status: "error",
      message: `No account found for "${email}". Nothing was deleted.`,
    };
  }

  revalidatePath(ADMIN_PATH);

  return {
    status: "success",
    message: `Deleted ${result.email} and all their data. The email is free to register again.`,
  };
}

/**
 * Delete a member by their user id, for the "Danger zone" on a member's detail
 * page — so an admin can review a user's chats and delete them in context,
 * without going back to the dashboard and re-typing their email. Confirm-gated,
 * refuses admin accounts, and on success sends the admin back to the directory.
 */
export async function deleteMemberAction(
  _prev: GrantState,
  formData: FormData
): Promise<GrantState> {
  if (!(await assertAdmin())) {
    return { status: "error", message: "Not authorized." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const confirmed = formData.get("confirm") === "on";

  if (!id) {
    return { status: "error", message: "Missing user id." };
  }

  if (!confirmed) {
    return {
      status: "error",
      message: "Tick the confirm box first — deleting a user is permanent.",
    };
  }

  const target = await getUserById(id);
  if (!target) {
    return { status: "error", message: "User not found. Nothing was deleted." };
  }

  // Never delete an admin account from this tool.
  if (isAdminEmail(target.email)) {
    return {
      status: "error",
      message: "That's an admin account — it can't be deleted from here.",
    };
  }

  const result = await deleteUserByEmail(target.email);
  if (!result.ok) {
    return { status: "error", message: "Nothing was deleted." };
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/users`);
  // The member no longer exists — return to the directory.
  redirect(`${ADMIN_PATH}/users`);
}

/**
 * Lock the panel: drop the passphrase cookie and bounce back to the unlock
 * screen. Wired to the "Lock panel" button in the dashboard header so an admin
 * can end their session on a shared machine.
 */
export async function lockPanelAction(): Promise<void> {
  await clearPanelCookie();
  redirect(`${ADMIN_PATH}/unlock`);
}
