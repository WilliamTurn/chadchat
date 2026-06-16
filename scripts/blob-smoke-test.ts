/**
 * Smoke-test the Vercel Blob store: upload a tiny blob, read it back over its
 * public URL, then delete it. Proves BLOB_READ_WRITE_TOKEN is wired correctly
 * without needing the app, auth, or a Pro user.
 *
 * Run with: pnpm tsx scripts/blob-smoke-test.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { del, put } from "@vercel/blob";

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN missing from .env.local");
  }

  const payload = `chad-blob-smoke-test ${Date.now()}`;
  console.log("Uploading test blob…");
  const blob = await put("smoke-test/hello.txt", payload, {
    access: "public",
    addRandomSuffix: true,
  });
  console.log("  ✓ uploaded:", blob.url);

  console.log("Reading it back…");
  const res = await fetch(blob.url);
  const text = await res.text();
  if (text !== payload) {
    throw new Error(`Read-back mismatch: got "${text}"`);
  }
  console.log("  ✓ read back matches");

  console.log("Deleting test blob…");
  await del(blob.url);
  console.log("  ✓ deleted");

  console.log("\nBlob store is working. ✅");
}

main().catch((err) => {
  console.error("\nBlob smoke test FAILED:", err);
  process.exit(1);
});
