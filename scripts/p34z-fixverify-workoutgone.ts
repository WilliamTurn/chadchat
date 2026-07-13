import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { workout, planSessionCompletion } from "../lib/db/schema";
config({ path: ".env.local" });
async function main() {
  const client = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const db = drizzle(client);
  const wid = process.argv[2];
  const w = await db.select({ id: workout.id }).from(workout).where(eq(workout.id, wid));
  const c = await db.select({ id: planSessionCompletion.id }).from(planSessionCompletion).where(eq(planSessionCompletion.workoutId, wid));
  console.log(JSON.stringify({ workoutId: wid, workoutRows: w.length, completionRowsForWorkout: c.length }));
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
