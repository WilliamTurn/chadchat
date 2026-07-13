import { config } from "dotenv";
import postgres from "postgres";
config({ path: ".env.local" });
async function main() {
  const c = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const [u] = await c`select id from "User" where email='claude-testing@example.com'`;
  const id = u.id;
  const wk = await c`select count(*)::int n from "Workout" where "userId"=${id}`;
  const pe = await c`select count(*)::int n from "ProgressEntry" where "userId"=${id}`;
  const rp = await c`select count(*)::int n from "WeeklyReport" where "userId"=${id}`;
  console.log("workouts", wk[0].n, "progressEntries", pe[0].n, "weeklyReports", rp[0].n);
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
