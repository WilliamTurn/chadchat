import "server-only";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { ADMIN_PATH, isAdminEmail } from "@/lib/admin";
import { isPanelUnlocked } from "@/lib/admin-gate";
import { getUserById } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";

/**
 * Server-side admin gate for admin pages and route handlers. Resolves to the
 * signed-in admin's user row, or throws a 404 (via notFound) for anyone who
 * isn't an allowlisted admin — so the page's very existence isn't leaked.
 *
 * Two gates: (1) the email allowlist, and (2) a passphrase unlock (NAV-34) —
 * even a signed-in admin is bounced to the unlock page until they enter the
 * shared secret. This is the real security boundary; every privileged admin
 * server action re-checks both separately (see the panel's actions.ts).
 */
export async function requireAdmin(): Promise<User> {
  const session = await auth();
  const me = session?.user?.id
    ? await getUserById(session.user.id)
    : undefined;

  if (!(me && isAdminEmail(me.email))) {
    notFound();
  }

  // Second gate: admins must unlock with the panel passphrase before anything
  // renders. The unlock page itself must NOT call this (it would loop).
  if (!(await isPanelUnlocked())) {
    redirect(`${ADMIN_PATH}/unlock`);
  }

  return me;
}
