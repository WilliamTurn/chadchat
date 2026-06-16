import { auth } from "@/app/(auth)/auth";
import { getUserById, getUserMemory } from "@/lib/db/queries";

/**
 * Per-user preferences the Settings dialog needs to render its controls
 * (currently just Chad's memory state). The memory toggle/clear actions enforce
 * auth themselves, so this is purely for showing the right state.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json(
      { memoryEnabled: false, hasMemory: false },
      { status: 401 }
    );
  }

  const [user, memoryRecord] = await Promise.all([
    getUserById(session.user.id),
    getUserMemory(session.user.id),
  ]);

  return Response.json({
    memoryEnabled: Boolean(user?.memoryEnabled),
    hasMemory: Boolean(memoryRecord?.profile?.trim()),
  });
}
