/**
 * FIX-39 VISUAL-REGRESSION DIFF GATE (P2-Z).
 *
 * Compares the freshly captured fixture screenshot set
 * (artifacts/fixture-screenshots, produced by `pnpm screenshot:fixtures`)
 * against the REVIEWED baseline manifest `tests/visual-baseline.json`
 * (sha256 per image). The capture suite is deterministic (animations frozen,
 * fonts awaited, fixed personas/anchor date), so a byte-level change means a
 * real visual change on a system surface.
 *
 * Any changed / missing / new image fails the gate; a reviewer approves a
 * pixel change by re-running with --update and committing the manifest diff
 * (the changed slugs are visible line-by-line in the PR).
 *
 * Rasterization is platform-specific, so the manifest holds ONE BASELINE PER
 * PLATFORM (win32 for local Windows runs, linux for CI). `--update` freezes
 * only the current platform's set; a platform with no frozen set gets an
 * ADVISORY pass with instructions, never a silent skip, so the gate is
 * armed everywhere a baseline has been reviewed.
 *
 * Usage:
 *   pnpm screenshot:fixtures      capture (dev server or FIXTURES_ENABLED build)
 *   pnpm screenshot:diff          gate against the reviewed baseline
 *   pnpm screenshot:approve       re-freeze this platform's baseline (reviewed)
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { platform } from "node:os";

const SHOTS = join(process.cwd(), "artifacts", "fixture-screenshots");
const MANIFEST = join(process.cwd(), "tests", "visual-baseline.json");
const update = process.argv.includes("--update");
const os = platform();

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(p));
    } else if (entry.name.endsWith(".png")) {
      out.push(p);
    }
  }
  return out;
}

if (!existsSync(SHOTS)) {
  console.error(
    "fixture-diff: no capture set found. Run `pnpm screenshot:fixtures` first."
  );
  process.exit(1);
}

const images = {};
for (const file of walk(SHOTS).sort()) {
  const key = relative(SHOTS, file).split(sep).join("/");
  images[key] = createHash("sha256").update(readFileSync(file)).digest("hex");
}

const manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, "utf8"))
  : {
      _meta: {
        role: "FIX-39 reviewed visual-regression baseline, one set per platform (see scripts/fixture-diff.mjs)",
      },
      platforms: {},
    };

if (update) {
  manifest.platforms = manifest.platforms ?? {};
  manifest.platforms[os] = {
    frozen: new Date().toISOString().slice(0, 10),
    imageCount: Object.keys(images).length,
    images,
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `fixture-diff: ${os} baseline frozen (${Object.keys(images).length} images).`
  );
  process.exit(0);
}

const baseline = manifest.platforms?.[os];
if (!baseline) {
  const others = Object.keys(manifest.platforms ?? {});
  console.warn(
    `fixture-diff: ADVISORY PASS - no reviewed baseline exists for "${os}" ` +
      `(frozen platforms: ${others.length ? others.join(", ") : "none"}). ` +
      "The gate is NOT armed on this platform until a reviewer freezes one with `pnpm screenshot:approve`."
  );
  process.exit(0);
}

const changed = [];
const missing = [];
const added = [];
for (const [key, hash] of Object.entries(baseline.images ?? {})) {
  if (!(key in images)) {
    missing.push(key);
  } else if (images[key] !== hash) {
    changed.push(key);
  }
}
for (const key of Object.keys(images)) {
  if (!(key in (baseline.images ?? {}))) {
    added.push(key);
  }
}

if (changed.length || missing.length || added.length) {
  console.error("fixture-diff: VISUAL CHANGES against the reviewed baseline.");
  for (const k of changed) {
    console.error(`  changed  ${k}`);
  }
  for (const k of missing) {
    console.error(`  missing  ${k}`);
  }
  for (const k of added) {
    console.error(`  new      ${k}`);
  }
  console.error(
    `fixture-diff: ${changed.length} changed, ${missing.length} missing, ${added.length} new (${os} baseline, frozen ${baseline.frozen}). ` +
      "If intended and reviewed, approve with `pnpm screenshot:approve` and commit tests/visual-baseline.json."
  );
  process.exit(1);
}

console.log(
  `fixture-diff: OK, ${Object.keys(images).length} images match the reviewed ${os} baseline (frozen ${baseline.frozen}).`
);
