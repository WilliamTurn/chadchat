/**
 * Throwaway end-to-end check for the admin grant feature. Creates a temp user
 * in the REAL Neon DB, runs the exact select+update setManualSubscriptionByEmail
 * performs, asserts the paywall (the real hasActiveAccess) agrees, then deletes
 * the temp user. Run: pnpm tsx scripts/admin-grant-smoke-test.ts
 *
 * (queries.ts can't be imported here — it pulls in `server-only` — so the write
 * is mirrored inline; lib/db/queries.ts is the source of truth, tsc-validated.)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "@/lib/db/schema";
import { hasActiveAccess } from "@/lib/subscription";

const TEST_EMAIL = `admin-smoke-${Date.now()}@example.test`;
const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
const db = drizzle(sql);

// Mirror of setManualSubscriptionByEmail's write.
async function grant(email: string, tier: "basic" | "pro" | null) {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db.select().from(user).where(eq(user.email, normalized));
  if (!existing) {
    return { ok: false as const, reason: "not_found" as const };
  }
  const [updated] = await db
    .update(user)
    .set({
      subscriptionTier: tier,
      subscriptionStatus: tier ? "active" : null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(user.id, existing.id))
    .returning();
  return { ok: true as const, user: updated };
}

async function main() {
  let pass = true;
  const check = (label: string, ok: boolean) => {
    pass = pass && ok;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  };

  try {
    await db.insert(user).values({ email: TEST_EMAIL, isAnonymous: false });

    const missing = await grant("nobody-here@example.test", "pro");
    check("unknown email returns not_found", missing.ok === false);

    const granted = await grant(TEST_EMAIL, "pro");
    check(
      "grant pro: tier=pro, status=active",
      granted.ok === true &&
        granted.user.subscriptionTier === "pro" &&
        granted.user.subscriptionStatus === "active"
    );
    check(
      "granted user passes paywall (hasActiveAccess)",
      granted.ok === true && hasActiveAccess(granted.user) === true
    );

    const revoked = await grant(TEST_EMAIL, null);
    check(
      "revoke: tier+status cleared, paywall denies",
      revoked.ok === true &&
        revoked.user.subscriptionTier === null &&
        revoked.user.subscriptionStatus === null &&
        hasActiveAccess(revoked.user) === false
    );
  } finally {
    await db.delete(user).where(eq(user.email, TEST_EMAIL));
    console.log(`cleaned up ${TEST_EMAIL}`);
    await sql.end();
  }

  console.log(pass ? "\nALL PASSED" : "\nFAILED");
  process.exit(pass ? 0 : 1);
}

main();
