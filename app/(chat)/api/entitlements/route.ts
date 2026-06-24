import { auth } from "@/app/(auth)/auth";
import { canAccessProFeatures } from "@/lib/admin";
import { getUserById } from "@/lib/db/queries";

/**
 * Per-user feature flags the chat UI needs to gate controls client-side
 * (e.g. the photo-upload button). Intentionally tiny — the upload route does
 * its own server-side enforcement, so this is purely for showing the right UI.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ photoAnalysis: false }, { status: 401 });
  }

  const user = await getUserById(session.user.id);

  if (!user) {
    return Response.json({ photoAnalysis: false }, { status: 401 });
  }

  // Mirror the upload route's gate exactly (admins are comped) so the UI
  // affordance and the server-side enforcement never disagree.
  return Response.json({ photoAnalysis: canAccessProFeatures(user) });
}
