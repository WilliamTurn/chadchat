/**
 * One-off VF-3 cleanup: the Round-3 tester uploaded flat color-block JPEGs
 * ("Chicken and rice" on orange, "Progress 6/29" on blue) as the meal and
 * progress photos on the claude-testing account. Replace the meal photo with
 * the real chicken-rice-broccoli asset (public/today/food-balanced-plate.png),
 * drop the progress placeholder, and delete both old blobs.
 * Run: pnpm tsx scripts/fix-placeholder-photos.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile } from "node:fs/promises";
import { del, put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { mealAnalysis, progressEntry, user } from "@/lib/db/schema";

const EMAIL = "claude-testing@example.com";
const MEAL_BLOB =
  "https://ljqrnslz7xqi4zj4.public.blob.vercel-storage.com/meal-photo-hI8fy0U2i9DPGilb7AHBu4EAUYeHfh.jpg";
const PROGRESS_BLOB =
  "https://ljqrnslz7xqi4zj4.public.blob.vercel-storage.com/progress-photo-eMIWxKTWiL0WJvDN5OPhAAKmhWS5yy.jpg";

async function main() {
  const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
  const db = drizzle(sql);
  try {
    const [u] = await db.select().from(user).where(eq(user.email, EMAIL));
    if (!u) {
      throw new Error(`no account for ${EMAIL}`);
    }

    // 1. Real photo up, placeholder meal photo swapped.
    const file = await readFile("public/today/food-balanced-plate.png");
    const blob = await put("meal-photo.png", file, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/png",
    });
    console.log("uploaded real meal photo:", blob.url);

    const meals = await db
      .update(mealAnalysis)
      .set({ photoUrl: blob.url })
      .where(
        and(eq(mealAnalysis.userId, u.id), eq(mealAnalysis.photoUrl, MEAL_BLOB))
      )
      .returning({ id: mealAnalysis.id, title: mealAnalysis.title });
    console.log("meal rows updated:", meals);

    // 2. Progress placeholder photo removed (entry itself stays).
    const progress = await db
      .update(progressEntry)
      .set({ photoUrl: null })
      .where(
        and(
          eq(progressEntry.userId, u.id),
          eq(progressEntry.photoUrl, PROGRESS_BLOB)
        )
      )
      .returning({ id: progressEntry.id, recordedAt: progressEntry.recordedAt });
    console.log("progress rows cleared:", progress);

    // 3. Old placeholder blobs deleted.
    if (meals.length > 0) {
      await del(MEAL_BLOB);
      console.log("deleted placeholder meal blob");
    }
    if (progress.length > 0) {
      await del(PROGRESS_BLOB);
      console.log("deleted placeholder progress blob");
    }
    console.log("done ✅");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
