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
 *   copy-vocabulary    The newer copy.ts vocabulary rules ("we", gym
 *                      assumptions, "session") under their own baseline key.
 *   example-placeholder  "e.g." example text in a placeholder prop (SYS-09:
 *                      it reads as an already-entered value).
 *   unconfirmed-destructive  onClick calling a remove-/delete- handler in a
 *                      file with no confirm-or-undo machinery (LAW 7).
 *   raw-overlay-import Importing recharts Tooltip / radix-ui outside
 *                      components/ui, bypassing the dismissal contracts.
 *   page-mounted-toaster  <Toaster> mounted in a page.tsx. A toast fired
 *                      right before a navigation dies with its page (the
 *                      XPK-15 lost-confirmation class); Toaster mounts once
 *                      per layout.tsx, never per page.
 *   silent-truncation  Tailwind `truncate`/`text-ellipsis` in member UI.
 *                      Silent ellipsis is the SYS-08 class ("Day 1: Legs,
 *                      Ham, Strin..."): text wraps or downsizes instead.
 *   native-confirm     window.confirm()/confirm() blocking browser dialogs.
 *                      Destructive confirms go through ConfirmActionDialog.
 *   jargon-leak        Internal analysis phrasing shown raw to members
 *                      ("domain", "trend smoothed", "all loaded history";
 *                      flaws PRG-03, TRN-24/29).
 *
 * New rules grandfather their current counts ONCE (tracked via "__rules__"
 * in the baseline), then ratchet down like everything else.
 *
 * Grandfathering: scripts/design-lint-baseline.json pins the pre-existing
 * violation count per file+rule. A count above baseline fails. The baseline
 * only shrinks, and it shrinks AUTOMATICALLY: every run rewrites any entry
 * whose current count is lower (and drops cleared entries), so an improvement
 * is locked in the moment it happens — a fixed file can never quietly climb
 * back up to an old, larger allowance. Commit the baseline change alongside
 * the fix. (--update is kept as an alias; it no longer does anything extra.)
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
  // The approved design-system reference sheet (dev-only, prod-404): a 1:1
  // reproduction of chadlatest's /design-system, whose specimen/atmosphere
  // literals (star field, SVG gradients, mock-sampled hues) are the sheet's
  // content, exactly like the tokens fixture above. The TOKENS it proves
  // live in app/globals.css.
  "app/dev/design-system/page.tsx",
  "app/dev/design-system/ds-sheet.css",
  // The canonical chart color home (the Color Law module).
  "lib/chart/palette.ts",
];

type RuleId =
  | "raw-color"
  | "arbitrary-utility"
  | "raw-control"
  | "banned-copy"
  | "copy-vocabulary"
  | "example-placeholder"
  | "unconfirmed-destructive"
  | "raw-overlay-import"
  | "page-mounted-toaster"
  | "silent-truncation"
  | "native-confirm"
  | "jargon-leak"
  | "raw-photo-input";

type Violation = { file: string; rule: RuleId; line: number; excerpt: string };

const HEX_RE = /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/;
const FUNC_COLOR_RE = /\b(?:rgba?|oklch|hsla?|color-mix|color)\(/;
const ARBITRARY_RE = /\b[a-z][a-z0-9-]*-\[(?!var\(--)[^\]]+\]/;
const RAW_CONTROL_RE = /<(?:button|input|select|textarea)\b/;
/** "e.g." example text in a placeholder reads as an entered value
 *  (flaws SYS-09). Placeholders state what to enter, never an example. */
const EXAMPLE_PLACEHOLDER_RE = /\bplaceholder\s*[=:]\s*.{0,60}?\be\.?g\b/i;
/** An onClick that calls a remove-/delete- handler in a file that never
 *  imports the confirm-or-undo machinery (charter LAW 7, flaws SYS-23). */
const UNCONFIRMED_DELETE_RE = /onClick=\{[^}]*\b(?:remove|delete)[A-Z]\w*\(/;
const CONFIRM_MACHINERY_RE =
  /ConfirmActionDialog|ConfirmDialog|toastUndo|confirm-undo/;
/** Overlay primitives (tooltips/popovers) carry the SYS-03/04 dismissal
 *  contract in components/ui; importing recharts' Tooltip or radix-ui
 *  directly anywhere else bypasses it. */
const RAW_OVERLAY_IMPORT_RE =
  /(?:\bTooltip\b[^\n]*from\s+["']recharts["']|from\s+["']radix-ui["'])/;
/** A Toaster mounted per page dies with the page, taking any toast fired
 *  just before a navigation with it (the XPK-15 lost-confirmation class).
 *  The render surface is one <Toaster> per layout.tsx. */
const TOASTER_MOUNT_RE = /<Toaster\b/;
/** Silent single-line ellipsis (SYS-08): the member sees "Strin..." and the
 *  information is simply gone. Wrap or downsize instead. */
const SILENT_TRUNCATION_RE = /\b(?:truncate|text-ellipsis)\b/;
/** Native blocking confirm dialogs bypass the designed confirm-or-undo
 *  machinery entirely. */
const NATIVE_CONFIRM_RE = /(?:window\.confirm\(|[^.\w]confirm\()/;
/** A raw file input outside the shared photo input cannot open the phone
 *  camera (RC-4: SYS-22, NUT-14, BOD-08). Photo affordances render through
 *  components/ui/photo-input.tsx, whose capture + gallery input PAIR keeps
 *  the one-tap camera AND the gallery path working on every platform (a
 *  single input with capture goes camera-only on many Android browsers). */
const RAW_PHOTO_INPUT_RE = /type=["']file["']/;
/** New copy patterns report under their own rule id so the long-standing
 *  banned-copy baseline keys stay stable. */
const VOCABULARY_COPY_IDS = new Set([
  "we-voice",
  "gym-assumption",
  "session-vocab",
]);
/** Internal jargon shown raw to members (flaws PRG-03, TRN-24/29); its own
 *  rule id so the patterns grandfather once instead of tripping the existing
 *  copy-vocabulary baseline. */
const JARGON_COPY_IDS = new Set(["jargon-domain", "jargon-internal-phrase"]);

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
  const hasConfirmMachinery = CONFIRM_MACHINERY_RE.test(text);
  const isPageFile = rel.endsWith(`${sep}page.tsx`);
  const isPhotoInputHome = rel === `components${sep}ui${sep}photo-input.tsx`;
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
    if (rel.endsWith(".tsx") && EXAMPLE_PLACEHOLDER_RE.test(line)) {
      push("example-placeholder");
    }
    if (
      rel.endsWith(".tsx") &&
      !hasConfirmMachinery &&
      UNCONFIRMED_DELETE_RE.test(line)
    ) {
      push("unconfirmed-destructive");
    }
    if (!isUiPrimitive && RAW_OVERLAY_IMPORT_RE.test(line)) {
      push("raw-overlay-import");
    }
    if (isPageFile && TOASTER_MOUNT_RE.test(line)) {
      push("page-mounted-toaster");
    }
    if (rel.endsWith(".tsx") && SILENT_TRUNCATION_RE.test(line)) {
      push("silent-truncation");
    }
    if (NATIVE_CONFIRM_RE.test(line)) {
      push("native-confirm");
    }
    if (
      rel.endsWith(".tsx") &&
      !isPhotoInputHome &&
      RAW_PHOTO_INPUT_RE.test(line)
    ) {
      push("raw-photo-input");
    }
    if (rel.endsWith(".tsx")) {
      let sawBanned = false;
      let sawVocabulary = false;
      let sawJargon = false;
      for (const rule of SYSTEM_COPY_BANNED) {
        if (rule.pattern.test(line)) {
          if (VOCABULARY_COPY_IDS.has(rule.id)) {
            sawVocabulary = true;
          } else if (JARGON_COPY_IDS.has(rule.id)) {
            sawJargon = true;
          } else {
            sawBanned = true;
          }
        }
      }
      if (sawBanned) {
        push("banned-copy");
      }
      if (sawVocabulary) {
        push("copy-vocabulary");
      }
      if (sawJargon) {
        push("jargon-leak");
      }
    }
  }
  return out;
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

function main() {
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

  let raw: Record<string, number | string[]> = {};
  try {
    raw = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    // First run: write the grandfather list.
    raw = {};
  }
  // "__rules__" records which rule ids have been grandfathered. Absent (a
  // baseline predating the marker) means the original four.
  const RULES_KEY = "__rules__";
  const baseline: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k !== RULES_KEY && typeof v === "number") {
      baseline[k] = v;
    }
  }
  const knownRules = new Set<string>(
    Array.isArray(raw[RULES_KEY])
      ? (raw[RULES_KEY] as string[])
      : ["raw-color", "arbitrary-utility", "raw-control", "banned-copy"]
  );

  const firstRun = Object.keys(baseline).length === 0;
  if (firstRun) {
    const next: Record<string, number> = {};
    const rules = new Set<string>();
    for (const [key, n] of [...counts.entries()].sort()) {
      next[key] = n;
      rules.add(key.split("::")[1]);
    }
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify({ [RULES_KEY]: [...rules].sort(), ...next }, null, 2)}\n`
    );
    console.log(
      `design-lint: baseline created with ${Object.keys(next).length} grandfathered entries.`
    );
    return;
  }

  // A rule id the baseline has never seen grandfathers its CURRENT counts
  // once (so a new gate can land without pre-cleaning the whole tree), then
  // ratchets down like every other rule. Existing rules never re-grandfather.
  let newRules = 0;
  for (const [key, n] of counts.entries()) {
    const rule = key.split("::")[1];
    if (!knownRules.has(rule)) {
      baseline[key] = n;
      newRules++;
    }
  }
  // Record every rule this script version knows (including ones with zero
  // current hits), so a rule never re-grandfathers on a later run.
  const ALL_RULES: RuleId[] = [
    "raw-color",
    "arbitrary-utility",
    "raw-control",
    "banned-copy",
    "copy-vocabulary",
    "example-placeholder",
    "unconfirmed-destructive",
    "raw-overlay-import",
    "page-mounted-toaster",
    "silent-truncation",
    "native-confirm",
    "jargon-leak",
    "raw-photo-input",
  ];
  for (const rule of ALL_RULES) {
    knownRules.add(rule);
  }
  if (newRules > 0) {
    console.log(
      `design-lint: grandfathered ${newRules} entr${newRules === 1 ? "y" : "ies"} for newly added rule(s). Commit scripts/design-lint-baseline.json.`
    );
  }

  // Auto-shrink: the baseline is min(pinned, current) on every run. Entries
  // never rise, never get added after the first run (new violations must be
  // fixed, not grandfathered), and cleared entries are dropped. Writing the
  // shrunk file here — not behind a flag nobody runs — is what makes the
  // ratchet one-way: an improvement is pinned the moment the lint sees it.
  const next: Record<string, number> = {};
  let shrunk = 0;
  for (const key of Object.keys(baseline).sort()) {
    const current = counts.get(key) ?? 0;
    if (current <= 0) {
      shrunk++;
      continue;
    }
    next[key] = Math.min(baseline[key], current);
    if (next[key] < baseline[key]) {
      shrunk++;
    }
  }
  if (shrunk > 0 || newRules > 0) {
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify({ [RULES_KEY]: [...knownRules].sort(), ...next }, null, 2)}\n`
    );
    console.log(
      `design-lint: baseline auto-shrunk (${shrunk} entr${shrunk === 1 ? "y" : "ies"} reduced or cleared). Commit scripts/design-lint-baseline.json with your change.`
    );
  }

  let failed = false;
  for (const [key, n] of [...counts.entries()].sort()) {
    const allowed = next[key] ?? 0;
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
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log("design-lint: OK");
}

main();
