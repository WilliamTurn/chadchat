/**
 * FEAT-22 e2e helper: inspect / time-shift / plant / delete QuitPrediction
 * rows for a test account, so the resolution sweep and danger-window paths
 * can be driven for real without waiting weeks.
 *
 *   pnpm tsx scripts/quit-e2e.ts show <email>
 *   pnpm tsx scripts/quit-e2e.ts shift <email> <daysBack>   (active row only)
 *   pnpm tsx scripts/quit-e2e.ts plant <email> <daysUntil>  (synthetic active row)
 *   pnpm tsx scripts/quit-e2e.ts delete <email> <predictionId>
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { quitPrediction, user } from "@/lib/db/schema";

const [cmd, email, arg] = process.argv.slice(2);
const DAY_MS = 86_400_000;

function todayAnchorUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

async function main() {
  const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
  const db = drizzle(sql);
  try {
    const [owner] = await db
      .select()
      .from(user)
      .where(eq(user.email, (email ?? "").trim().toLowerCase()));
    if (!owner) {
      console.log("no such user");
      return;
    }

    if (cmd === "show") {
      const rows = await db
        .select()
        .from(quitPrediction)
        .where(eq(quitPrediction.userId, owner.id))
        .orderBy(desc(quitPrediction.predictedAt));
      for (const r of rows) {
        const c = r.content as Record<string, unknown>;
        console.log(
          `${r.id}\n  status=${r.status} quitDate=${r.quitDate.toISOString()} predictedAt=${r.predictedAt.toISOString()} resolvedAt=${r.resolvedAt?.toISOString() ?? "-"}\n  dayCount=${c.dayCount} dateLabel=${c.dateLabel} round=${c.round ?? 1}\n  outcome=${JSON.stringify(c.outcome ?? null)}\n  narrative=${String(c.narrative).slice(0, 220)}...`
        );
      }
      return;
    }

    if (cmd === "shift") {
      const daysBack = Number(arg);
      const [active] = await db
        .select()
        .from(quitPrediction)
        .where(
          and(
            eq(quitPrediction.userId, owner.id),
            eq(quitPrediction.status, "active")
          )
        )
        .orderBy(desc(quitPrediction.predictedAt));
      if (!active) {
        console.log("no active prediction");
        return;
      }
      const newQuit = new Date(todayAnchorUTC().getTime() - daysBack * DAY_MS);
      await db
        .update(quitPrediction)
        .set({ quitDate: newQuit })
        .where(eq(quitPrediction.id, active.id));
      console.log(
        `shifted ${active.id}: quitDate ${active.quitDate.toISOString()} -> ${newQuit.toISOString()}`
      );
      return;
    }

    if (cmd === "plant") {
      const daysUntil = Number(arg);
      const dayCount = 23;
      const quitDate = new Date(
        todayAnchorUTC().getTime() + daysUntil * DAY_MS
      );
      const [row] = await db
        .insert(quitPrediction)
        .values({
          userId: owner.id,
          quitDate,
          failureMode: "Work gets busy, one skipped week becomes forever",
          content: {
            answers: {
              appsTried: "3-5",
              restarts: "4-6",
              longestStreak: "3-4w",
              lastKiller: "work",
              lifeLoad: "heavy",
              confession:
                "Work blew up in week four, I skipped a Monday, told myself I'd restart the next week, and never opened the app again.",
            },
            dayCount,
            quitDateISO: quitDate.toISOString().slice(0, 10),
            dateLabel: quitDate.toLocaleDateString("en-US", {
              timeZone: "UTC",
              month: "short",
              day: "numeric",
            }),
            failureMode: "Work gets busy, one skipped week becomes forever",
            narrative:
              "Synthetic test verdict planted by scripts/quit-e2e.ts. Delete me.",
          },
        })
        .returning();
      console.log(`planted ${row.id} quitDate=${row.quitDate.toISOString()}`);
      return;
    }

    if (cmd === "delete") {
      await db
        .delete(quitPrediction)
        .where(
          and(
            eq(quitPrediction.id, arg),
            eq(quitPrediction.userId, owner.id)
          )
        );
      console.log(`deleted ${arg}`);
      return;
    }

    console.log("usage: show|shift|plant|delete");
  } finally {
    await sql.end();
  }
}

main();
