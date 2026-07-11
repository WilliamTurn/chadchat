/**
 * One-time backfill for the Files page (FEAT-45): scan every chat message for
 * file attachments (photos members sent to Chad) and record each one as a
 * UserUpload row so historic uploads appear on /files.
 *
 * Idempotent: skips URLs that already have a UserUpload row.
 * Run: pnpm tsx scripts/backfill-user-uploads.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { chat, message, userUpload } from "@/lib/db/schema";

type FileRef = {
  url: string;
  name: string;
  contentType: string;
  createdAt: Date;
};

function collectFileRefs(row: {
  parts: unknown;
  attachments: unknown;
  createdAt: Date;
}): FileRef[] {
  const refs: FileRef[] = [];

  if (Array.isArray(row.parts)) {
    for (const part of row.parts) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "file" &&
        typeof (part as { url?: string }).url === "string"
      ) {
        const p = part as {
          url: string;
          filename?: string;
          mediaType?: string;
        };
        refs.push({
          url: p.url,
          name: p.filename ?? nameFromUrl(p.url),
          contentType: p.mediaType ?? "application/octet-stream",
          createdAt: row.createdAt,
        });
      }
    }
  }

  if (Array.isArray(row.attachments)) {
    for (const attachment of row.attachments) {
      if (
        attachment &&
        typeof attachment === "object" &&
        typeof (attachment as { url?: string }).url === "string"
      ) {
        const a = attachment as {
          url: string;
          name?: string;
          contentType?: string;
        };
        refs.push({
          url: a.url,
          name: a.name ?? nameFromUrl(a.url),
          contentType: a.contentType ?? "application/octet-stream",
          createdAt: row.createdAt,
        });
      }
    }
  }

  return refs;
}

/** A readable display name when the attachment carried none: the blob URL's
 *  file basename (e.g. "gym-photo_a1b2.jpg"), decoded. */
function nameFromUrl(url: string): string {
  try {
    const base = decodeURIComponent(
      new URL(url).pathname.split("/").pop() ?? ""
    );
    return base || "photo";
  } catch {
    return "photo";
  }
}

async function main() {
  const client = postgres(process.env.POSTGRES_URL ?? "");
  const db = drizzle(client);

  // Repair pass: earlier backfills stored the literal fallback name "file";
  // give those rows a real name derived from their URL.
  const badlyNamed = await db
    .select({ id: userUpload.id, url: userUpload.url })
    .from(userUpload)
    .where(eq(userUpload.name, "file"));
  for (const row of badlyNamed) {
    await db
      .update(userUpload)
      .set({ name: nameFromUrl(row.url) })
      .where(eq(userUpload.id, row.id));
  }
  if (badlyNamed.length > 0) {
    console.log(`Renamed ${badlyNamed.length} uploads that were named "file".`);
  }

  const existing = await db.select({ url: userUpload.url }).from(userUpload);
  const seen = new Set(existing.map((row) => row.url));

  const rows = await db
    .select({
      parts: message.parts,
      attachments: message.attachments,
      createdAt: message.createdAt,
      userId: chat.userId,
    })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(eq(message.role, "user"));

  let inserted = 0;
  for (const row of rows) {
    for (const ref of collectFileRefs(row)) {
      if (seen.has(ref.url)) {
        continue;
      }
      seen.add(ref.url);
      await db.insert(userUpload).values({
        userId: row.userId,
        url: ref.url,
        name: ref.name,
        contentType: ref.contentType,
        size: null,
        createdAt: ref.createdAt,
      });
      inserted += 1;
    }
  }

  console.log(
    `Backfill complete: ${inserted} uploads recorded (${seen.size} total known URLs).`
  );
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
