#!/usr/bin/env node
// DSH-16 — image generation pipeline for the /today dashboard overhaul.
//
// Generates brand assets (hero figure, goal body diagrams, food photos) via the
// OpenAI images API and writes them as PNGs into chadchat/public.
//
// CLI usage:
//   node scripts/gen-image.mjs "<prompt>" out.png [size] [quality]
//
//   size     1024x1024 (default) | 1536x1024 | 1024x1536
//   quality  high (default) | medium | low
//
// Env (read from .env.local, then process.env):
//   OPENAI_API_KEY   required
//   IMG_MODEL        default "gpt-image-2"
//   IMG_TRANSPARENT  "1" → transparent background (forces PNG; for cutout diagrams)
//
// The batch driver (scripts/gen-today-assets.mjs) imports generateImage() from here.
//
// The key is read from .env.local (gitignored) — never hard-code it. ROTATE LATER:
// the key was pasted in plaintext chat, so treat it as compromised once shipping.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// --- load OPENAI_API_KEY from .env.local (no dotenv dependency) ---------------
let envLoaded = false;
export function loadEnvLocal() {
  if (envLoaded) return;
  envLoaded = true;
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, vRaw] = m;
      if (process.env[k] !== undefined) continue; // real env wins
      let v = vRaw.trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  } catch {
    // no .env.local — rely on process.env
  }
}

/**
 * Generate one image and write it to `outPath` (relative to cwd).
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string} opts.outPath
 * @param {string} [opts.size="1024x1024"]
 * @param {string} [opts.quality="high"]
 * @param {boolean} [opts.transparent=false]
 * @returns {Promise<{outPath: string, kb: number}>}
 */
export async function generateImage({
  prompt,
  outPath,
  size = "1024x1024",
  quality = "high",
  transparent = false,
}) {
  loadEnvLocal();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY (set it in .env.local).");

  const model = process.env.IMG_MODEL || "gpt-image-2";
  const body = { model, prompt, size, quality, n: 1 };
  if (transparent) {
    body.background = "transparent";
    body.output_format = "png";
  }

  console.log(
    `→ ${model} · ${size} · ${quality}${transparent ? " · transparent" : ""}`,
  );
  console.log(`  "${prompt.slice(0, 90)}${prompt.length > 90 ? "…" : ""}"`);

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }

  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(
      `No image data returned: ${JSON.stringify(json).slice(0, 400)}`,
    );
  }

  const abs = resolve(process.cwd(), outPath);
  mkdirSync(dirname(abs), { recursive: true });
  const buf = Buffer.from(b64, "base64");
  writeFileSync(abs, buf);
  const kb = Math.round(buf.length / 1024);
  console.log(`✓ wrote ${outPath} (${kb} KB)`);
  return { outPath, kb };
}

// --- CLI ---------------------------------------------------------------------
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const [, , prompt, outArg, sizeArg, qualityArg] = process.argv;
  if (!prompt || !outArg) {
    console.error(
      'Usage: node scripts/gen-image.mjs "<prompt>" out.png [size] [quality]',
    );
    process.exit(1);
  }
  try {
    await generateImage({
      prompt,
      outPath: outArg,
      size: sizeArg || "1024x1024",
      quality: qualityArg || "high",
      transparent: process.env.IMG_TRANSPARENT === "1",
    });
  } catch (err) {
    console.error(String(err.message || err));
    process.exit(1);
  }
}
