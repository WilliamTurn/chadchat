"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { isAdminEmail } from "@/lib/admin";
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

/** Re-check admin on every privileged action — the page check alone isn't a security boundary. */
async function assertAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) {
    return false;
  }
  const me = await getUserById(session.user.id);
  return isAdminEmail(me?.email);
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

  let tier: "basic" | "pro" | null;
  if (tierRaw === "basic" || tierRaw === "pro") {
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

  revalidatePath("/admin");

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

  revalidatePath("/admin");

  return {
    status: "success",
    message: `Deleted ${result.email} and all their data. The email is free to register again.`,
  };
}
