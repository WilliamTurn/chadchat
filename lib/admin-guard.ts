import "server-only";

import { notFound } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { isAdminEmail } from "@/lib/admin";
import { getUserById } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";

/**
 * Server-side admin gate for admin pages and route handlers. Resolves to the
 * signed-in admin's user row, or throws a 404 (via notFound) for anyone who
 * isn't an allowlisted admin — so the page's very existence isn't leaked.
 *
 * This is the real security boundary; every privileged admin server action
 * re-checks separately (see app/admin/actions.ts).
 */
export async function requireAdmin(): Promise<User> {
  const session = await auth();
  const me = session?.user?.id
    ? await getUserById(session.user.id)
    : undefined;

  if (!(me && isAdminEmail(me.email))) {
    notFound();
  }

  return me;
}
