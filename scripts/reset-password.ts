/**
 * Reset a user's password by email (no reset-email flow exists in the app).
 * Run: pnpm tsx scripts/reset-password.ts you@example.com newpassword
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "@/lib/db/schema";
import { generateHashedPassword } from "@/lib/db/utils";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const newPassword = process.argv[3];

async function main() {
  if (!email || !newPassword) {
    console.log("usage: tsx scripts/reset-password.ts <email> <newPassword>");
    process.exit(1);
  }
  const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
  const db = drizzle(sql);
  try {
    const result = await db
      .update(user)
      .set({ password: generateHashedPassword(newPassword), updatedAt: new Date() })
      .where(eq(user.email, email))
      .returning({ id: user.id });
    if (result.length === 0) {
      console.log(`NO ACCOUNT found for "${email}" — nothing changed.`);
    } else {
      console.log(`Password reset for "${email}". You can now log in with it.`);
    }
  } finally {
    await sql.end();
  }
}

main();
