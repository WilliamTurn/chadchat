"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { isAdminEmail } from "@/lib/admin";
import { getUserById, setManualSubscriptionByEmail } from "@/lib/db/queries";
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
