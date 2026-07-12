/**
 * DESIGN-SYSTEM ENFORCEMENT LINT (FIX-37, DSH-66 Phase 2 P2-A).
 *
 * Off-system UI is a build failure, not a review note (Primer/Polaris
 * lint-plugin practice). Wired into `pnpm build` so Vercel deploys fail on
 * violations. Biome cannot host custom rules, so this is a standalone pass.
 *
 * Rules (each violation is one matching line):
 *   raw-color          Hex / rgb() / oklch() literals outside the token homes
 *                      (globals.css, lib/chart/palette.ts). Colors come from
 *                      tokens; charts import lib/chart/palette.
 *   arbitrary-utility  Tailwind arbitrary values (w-[347px], text-[11px]).
 *                      Token references (shadow-[var(--shadow-card)]) are
 *                      allowed; hardcoded magnitudes are not.
 *   raw-control        <button>/<input>/<select>/<textarea> outside
 *                      components/ui/**. Compose the ui primitives instead.
 *   banned-copy        lib/contracts/copy.ts tripwires (em-dashes, generic
 *                      "View all", snark, moral grading...) in system UI.
 *
 * Grandfathering: scripts/design-lint-baseline.json pins the pre-existing
 * violation count per file+rule. A count above baseline fails; below
 * baseline prints a reminder to shrink it (run with --update to rewrite).
 * The baseline only shrinks: --update refuses to raise any count.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import process from "node:process";
import { SYSTEM_COPY_BANNED } from "../lib/contracts/copy";

// Run from the chadchat package root (the way `pnpm lint:design` and the
// build script invoke it).
const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, "scripts", "design-lint-baseline.json");
const SCAN_DIRS = ["app", "components", "hooks"];
/** lib/ is scanned for raw colors only (colors must live in the token homes);
 *  copy and control rules do not apply there (Chad's voice in lib/ai is out
 *  of scope by owner law, and lib has no member-facing JSX). */
const COLOR_ONLY_DIRS = ["lib"];

/** Token homes and non-UI code the rules do not apply to. */
const EXCLUDED = [
  "app/globals.css",
  // The token specimen sheet displays the measured hex values on purpose.
  "app/dev/fixtures/tokens/page.tsx",
  // The canonical chart color home (the Color Law module).
  "lib/chart/palette.ts",
];

type RuleId = "raw-color" | "arbitrary-utility" | "raw-control" | "banned-copy";

type Violation = { file: string; rule: RuleId; line: number; excerpt: string };

const HEX_RE = /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/;
const FUNC_COLOR_RE = /\b(?:rgba?|oklch|hsla?|color-mix|color)\(/;
const ARBITRARY_RE = /\b[a-z][a-z0-9-]*-\[(?!var\(--)[^\]]+\]/;
const RAW_CONTROL_RE = /<(?:button|input|select|textarea)\b/;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") {
        continue;
      }
      yield* walk(p);
    } else if (/\.(?:tsx|ts|css)$/.test(name) && !name.endsWith(".d.ts")) {
      yield p;
    }
  }
}

function lintFile(rel: string, text: string, colorOnly: boolean): Violation[] {
  const out: Violation[] = [];
  const isUiPrimitive = rel.startsWith(`components${sep}ui${sep}`);
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const push = (rule: RuleId) =>
      out.push({ file: rel, rule, line: i + 1, excerpt: line.trim().slice(0, 120) });

    if (HEX_RE.test(line) || FUNC_COLOR_RE.test(line)) {
      push("raw-color");
    }
    if (colorOnly) {
      continue;
    }
    if (ARBITRARY_RE.test(line)) {
      push("arbitrary-utility");
    }
    if (rel.endsWith(".tsx") && !isUiPrimitive && RAW_CONTROL_RE.test(line)) {
      push("raw-control");
    }
    if (rel.endsWith(".tsx")) {
      for (const rule of SYSTEM_COPY_BANNED) {
        if (rule.pattern.test(line)) {
          push("banned-copy");
          break;
        }
      }
    }
  }
  return out;
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

function main() {
  const update = process.argv.includes("--update");
  const violations: Violation[] = [];

  for (const dir of [...SCAN_DIRS, ...COLOR_ONLY_DIRS]) {
    const colorOnly = COLOR_ONLY_DIRS.includes(dir);
    for (const abs of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, abs);
      if (EXCLUDED.includes(toPosix(rel))) {
        continue;
      }
      violations.push(...lintFile(rel, readFileSync(abs, "utf8"), colorOnly));
    }
  }

  // Aggregate to file+rule counts.
  const counts = new Map<string, number>();
  for (const v of violations) {
    const key = `${toPosix(v.file)}::${v.rule}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let baseline: Record<string, number> = {};
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    // First run: write the grandfather list.
    baseline = {};
  }

  if (update || Object.keys(baseline).length === 0) {
    const firstRun = Object.keys(baseline).length === 0;
    const next: Record<string, number> = {};
    for (const [key, n] of [...counts.entries()].sort()) {
      const prior = baseline[key];
      // The baseline only shrinks: never raise an entry, never add one after
      // the first run (new violations must be fixed, not grandfathered).
      if (prior == null) {
        if (firstRun) {
          next[key] = n;
        }
      } else {
        next[key] = Math.min(prior, n);
      }
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log(
      `design-lint: baseline ${firstRun ? "created" : "updated"} with ${Object.keys(next).length} grandfathered entries.`
    );
    if (firstRun) {
      return;
    }
  }

  let failed = false;
  let shrinkable = 0;
  const seen = new Set<string>();
  for (const [key, n] of [...counts.entries()].sort()) {
    seen.add(key);
    const allowed = baseline[key] ?? 0;
    if (n > allowed) {
      failed = true;
      console.error(
        `FAIL ${key}: ${n} violation(s), baseline allows ${allowed}. New off-system UI is a build failure (FIX-37).`
      );
      for (const v of violations.filter(
        (x) => `${toPosix(x.file)}::${x.rule}` === key
      )) {
        console.error(`   ${toPosix(v.file)}:${v.line}  ${v.excerpt}`);
      }
    } else if (n < allowed) {
      shrinkable++;
    }
  }
  for (const key of Object.keys(baseline)) {
    if (!seen.has(key) && baseline[key] > 0) {
      shrinkable++;
    }
  }

  if (shrinkable > 0) {
    console.log(
      `design-lint: ${shrinkable} baseline entr${shrinkable === 1 ? "y" : "ies"} can shrink; run \`pnpm lint:design --update\`.`
    );
  }
  if (failed) {
    process.exit(1);
  }
  console.log("design-lint: OK");
}

main();
