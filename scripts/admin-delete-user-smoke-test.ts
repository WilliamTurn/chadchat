/**
 * Throwaway end-to-end check for the admin "delete user" feature. Creates a
 * temp user in the REAL Neon DB with a row in every table that references them
 * (chat -> message/vote/stream, document -> suggestion, memory), runs the exact
 * cascade deleteUserByEmail performs, then asserts every related row — and the
 * user — is gone. Run: pnpm tsx scripts/admin-delete-user-smoke-test.ts
 *
 * (queries.ts can't be imported here — it pulls in `server-only` — so the
 * delete is mirrored inline; lib/db/queries.ts is the source of truth,
 * tsc-validated.)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  chat,
  document,
  message,
  stream,
  suggestion,
  user,
  userMemory,
  vote,
} from "@/lib/db/schema";

const TEST_EMAIL = `delete-smoke-${Date.now()}@example.test`;
const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
const db = drizzle(sql);

// Mirror of deleteUserByEmail's cascade (FK-safe order, one transaction).
async function deleteByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, normalized));
  if (!existing) {
    return { ok: false as const, reason: "not_found" as const };
  }
  const userId = existing.id;
  await db.transaction(async (tx) => {
    const userChats = await tx
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));
    const chatIds = userChats.map((c) => c.id);
    if (chatIds.length > 0) {
      await tx.delete(vote).where(inArray(vote.chatId, chatIds));
      await tx.delete(message).where(inArray(message.chatId, chatIds));
      await tx.delete(stream).where(inArray(stream.chatId, chatIds));
      await tx.delete(chat).where(eq(chat.userId, userId));
    }
    await tx.delete(suggestion).where(eq(suggestion.userId, userId));
    await tx.delete(document).where(eq(document.userId, userId));
    await tx.delete(userMemory).where(eq(userMemory.userId, userId));
    await tx.delete(user).where(eq(user.id, userId));
  });
  return { ok: true as const, email: normalized };
}

async function main() {
  let pass = true;
  const check = (label: string, ok: boolean) => {
    pass = pass && ok;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  };

  let userId = "";
  try {
    // --- Seed a user with a row in every dependent table ---
    const [u] = await db
      .insert(user)
      .values({ email: TEST_EMAIL, isAnonymous: false })
      .returning();
    userId = u.id;

    const chatId = randomUUID();
    await db
      .insert(chat)
      .values({ id: chatId, createdAt: new Date(), title: "t", userId });

    const messageId = randomUUID();
    await db.insert(message).values({
      id: messageId,
      chatId,
      role: "user",
      parts: [],
      attachments: [],
      createdAt: new Date(),
    });
    await db
      .insert(vote)
      .values({ chatId, messageId, isUpvoted: true });
    await db.insert(stream).values({ chatId, createdAt: new Date() });

    const docId = randomUUID();
    const docCreatedAt = new Date();
    await db.insert(document).values({
      id: docId,
      createdAt: docCreatedAt,
      title: "d",
      kind: "text",
      userId,
    });
    await db.insert(suggestion).values({
      documentId: docId,
      documentCreatedAt: docCreatedAt,
      originalText: "a",
      suggestedText: "b",
      userId,
      createdAt: new Date(),
    });
    await db.insert(userMemory).values({ userId, profile: "remember me" });

    // --- Unknown email is a no-op ---
    const missing = await deleteByEmail("nobody-here@example.test");
    check("unknown email returns not_found", missing.ok === false);

    // --- The real cascade ---
    const result = await deleteByEmail(TEST_EMAIL);
    check("delete returns ok", result.ok === true);

    // --- Everything is gone ---
    const left = async (table: any, col: any, val: any) =>
      (await db.select().from(table).where(eq(col, val))).length;

    check("user row gone", (await left(user, user.id, userId)) === 0);
    check("chat gone", (await left(chat, chat.userId, userId)) === 0);
    check(
      "messages gone",
      (await left(message, message.chatId, chatId)) === 0
    );
    check("votes gone", (await left(vote, vote.chatId, chatId)) === 0);
    check("streams gone", (await left(stream, stream.chatId, chatId)) === 0);
    check(
      "documents gone",
      (await left(document, document.userId, userId)) === 0
    );
    check(
      "suggestions gone",
      (await left(suggestion, suggestion.userId, userId)) === 0
    );
    check(
      "memory gone",
      (await left(userMemory, userMemory.userId, userId)) === 0
    );
  } finally {
    // Belt-and-suspenders cleanup if an assertion threw mid-way.
    if (userId) {
      const chatIds = (
        await db.select({ id: chat.id }).from(chat).where(eq(chat.userId, userId))
      ).map((c) => c.id);
      if (chatIds.length > 0) {
        await db.delete(vote).where(inArray(vote.chatId, chatIds));
        await db.delete(message).where(inArray(message.chatId, chatIds));
        await db.delete(stream).where(inArray(stream.chatId, chatIds));
        await db.delete(chat).where(eq(chat.userId, userId));
      }
      await db.delete(suggestion).where(eq(suggestion.userId, userId));
      await db.delete(document).where(eq(document.userId, userId));
      await db.delete(userMemory).where(eq(userMemory.userId, userId));
      await db.delete(user).where(eq(user.id, userId));
    }
    await sql.end();
  }

  console.log(pass ? "\nALL PASSED" : "\nFAILED");
  process.exit(pass ? 0 : 1);
}

main();
