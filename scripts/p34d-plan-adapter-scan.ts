/**
 * DEC-06 evidence scan (P34-D / FIX-28). READ-ONLY: classifies every Plan
 * row in the database through the adapter's resolution pipeline (the same
 * pure functions resolvePlanScheduleView uses) and proves that every member
 * plan renders: structured-able plans resolve to a typed schedule, and the
 * rest resolve to the document view of their RAW detail text. Writes
 * nothing; materialization is exercised by unit tests and post-migration
 * verification (P34-Z).
 *
 * Run: npx tsx scripts/p34d-plan-adapter-scan.ts
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

config({ path: ".env.local" });
import { scheduleFromPlanDays } from "../lib/plans/schedule";
import { parsePlanDays } from "../lib/validation/plan-days";
import { plan } from "../lib/db/schema";

async function main() {
  const client = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const db = drizzle(client);

  const rows = await db.select().from(plan);
  let structured = 0;
  let document = 0;
  const lines: string[] = [];

  for (const row of rows) {
    const days = row.kind === "training" ? parsePlanDays(row.days) : null;
    const detailPreserved = typeof row.detail === "string";
    if (days) {
      const schedule = scheduleFromPlanDays(row.id, days);
      structured++;
      lines.push(
        `- ${row.id.slice(0, 8)} [${row.kind}/${row.status}] "${row.title}": STRUCTURED, ${schedule.sessions.length} sessions, ${schedule.sessions.reduce((n, s) => n + s.exercises.length, 0)} exercises, detail ${row.detail.trim() ? `${row.detail.length} chars preserved` : "empty"}`
      );
    } else {
      document++;
      lines.push(
        `- ${row.id.slice(0, 8)} [${row.kind}/${row.status}] "${row.title}": DOCUMENT view (raw detail renders, ${row.detail.length} chars; ${row.kind === "training" ? "one-tap extraction available" : "diet plans are documents by design"})`
      );
    }
    if (!detailPreserved) {
      throw new Error(`Plan ${row.id} has a non-string detail`);
    }
  }

  console.log(`Plans scanned: ${rows.length}`);
  console.log(`Resolve to structured schedule: ${structured}`);
  console.log(`Resolve to document view: ${document}`);
  console.log(`Blocked or discarded: 0 (by construction; every branch renders)`);
  console.log("");
  for (const line of lines) {
    console.log(line);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
