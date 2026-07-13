import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { plan, user } from "../lib/db/schema";

config({ path: ".env.local" });

async function main() {
  const client = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const db = drizzle(client);
  const [tester] = await db.select({ id: user.id }).from(user).where(eq(user.email, "claude-testing@example.com")).limit(1);
  console.log("tester id:", tester?.id);
  const plans = await db.select({ id: plan.id, title: plan.title, kind: plan.kind, status: plan.status }).from(plan).where(eq(plan.userId, tester.id));
  console.log("plans:", plans.length);
  for (const p of plans) console.log(` [${p.status}] ${p.kind} "${p.title}" ${p.id}`);
  const activeTraining = plans.filter(p => p.kind === "training" && p.status === "active");
  console.log("active training count:", activeTraining.length);
  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
