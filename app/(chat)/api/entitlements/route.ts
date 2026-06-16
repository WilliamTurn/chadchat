import { auth } from "@/app/(auth)/auth";
import { getEntitlements } from "@/lib/ai/entitlements";
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

  const { photoAnalysis } = getEntitlements(user);

  return Response.json({ photoAnalysis });
}
