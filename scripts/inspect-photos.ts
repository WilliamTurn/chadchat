/**
 * Read-only: list every stored photoUrl (meal analyses + progress entries) for
 * the test accounts, so we can fetch the blobs and see what was actually
 * uploaded (VF-3 investigation). Run: pnpm tsx scripts/inspect-photos.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq, inArray, isNotNull, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { mealAnalysis, progressEntry, user } from "@/lib/db/schema";

const EMAILS = ["claude-testing@example.com", "stellarluxedecor@gmail.com"];

async function main() {
  const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
  const db = drizzle(sql);
  try {
    const users = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(inArray(user.email, EMAILS));
    for (const u of users) {
      console.log(`\n=== ${u.email} (${u.id}) ===`);
      const meals = await db
        .select({
          id: mealAnalysis.id,
          title: mealAnalysis.title,
          kind: mealAnalysis.kind,
          source: mealAnalysis.source,
          createdAt: mealAnalysis.createdAt,
          photoUrl: mealAnalysis.photoUrl,
        })
        .from(mealAnalysis)
        .where(
          and(eq(mealAnalysis.userId, u.id), isNotNull(mealAnalysis.photoUrl))
        );
      console.log(`-- meal analyses with photos: ${meals.length}`);
      for (const m of meals) {
        console.log(
          `  [${m.createdAt.toISOString()}] ${m.kind}/${m.source} "${m.title}"\n    ${m.photoUrl}`
        );
      }
      const progress = await db
        .select({
          id: progressEntry.id,
          recordedAt: progressEntry.recordedAt,
          createdAt: progressEntry.createdAt,
          photoUrl: progressEntry.photoUrl,
        })
        .from(progressEntry)
        .where(
          and(eq(progressEntry.userId, u.id), isNotNull(progressEntry.photoUrl))
        );
      console.log(`-- progress entries with photos: ${progress.length}`);
      for (const p of progress) {
        console.log(
          `  [recorded ${p.recordedAt.toISOString()} | created ${p.createdAt.toISOString()}]\n    ${p.photoUrl}`
        );
      }
    }
  } finally {
    await sql.end();
  }
}

main();
