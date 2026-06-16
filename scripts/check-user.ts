/**
 * Read-only: check whether an email has an account and whether a given password
 * would log in. Run: pnpm tsx scripts/check-user.ts you@example.com [password]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { compare } from "bcrypt-ts";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "@/lib/db/schema";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const password = process.argv[3];

async function main() {
  const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
  const db = drizzle(sql);
  try {
    const [u] = await db.select().from(user).where(eq(user.email, email));
    if (!u) {
      console.log(`NO ACCOUNT found for "${email}"`);
      return;
    }
    console.log(`ACCOUNT EXISTS for "${email}" (created ${u.createdAt})`);
    console.log(`  tier/status: ${u.subscriptionTier ?? "none"} / ${u.subscriptionStatus ?? "none"}`);
    if (password) {
      const ok = u.password ? await compare(password, u.password) : false;
      console.log(`  password "${password}" => ${ok ? "CORRECT (this logs in)" : "WRONG"}`);
    }
  } finally {
    await sql.end();
  }
}

main();
