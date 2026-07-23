/**
 * PostToolUse hook (S0b-1, 2026-07-22): design-lint the ONE file Claude just
 * edited and inject any new-above-baseline violations back into the session
 * (stderr + exit 2) the moment they are written, instead of at the stop gate.
 *
 * FAIL-OPEN BY OWNER DECISION: any internal error (bad stdin, missing file,
 * import failure, crash) exits 0 silently. Only a successful lint run that
 * finds real above-baseline violations may exit 2.
 */

import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

async function main(): Promise<number> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

  const stdin = readFileSync(0, "utf8");
  const payload = JSON.parse(stdin) as {
    tool_input?: { file_path?: string };
  };
  const filePath = payload.tool_input?.file_path;
  if (!filePath) {
    return 0;
  }

  const abs = resolve(filePath);
  const rel = relative(root, abs);
  // Only lintable member-side files; anything else is out of scope.
  if (rel.startsWith("..") || !/\.(?:tsx|ts|css)$/.test(rel) || rel.endsWith(".d.ts")) {
    return 0;
  }
  const posix = rel.split(sep).join("/");
  const top = posix.split("/")[0];
  const colorOnly = top === "lib";
  if (!["app", "components", "hooks", "lib"].includes(top)) {
    return 0;
  }
  // The same token homes design-lint excludes.
  const EXCLUDED = new Set([
    "app/globals.css",
    "app/dev/fixtures/tokens/page.tsx",
    "app/dev/design-system/page.tsx",
    "app/dev/design-system/ds-sheet.css",
    "lib/chart/palette.ts",
  ]);
  if (EXCLUDED.has(posix)) {
    return 0;
  }

  // Single-file lint: never the whole-tree scan (that's the Stop gate's job).
  const { lintFile } = await import("../../scripts/design-lint");
  const violations = lintFile(rel, readFileSync(abs, "utf8"), colorOnly);
  if (violations.length === 0) {
    return 0;
  }

  const baselineRaw = JSON.parse(
    readFileSync(join(root, "scripts", "design-lint-baseline.json"), "utf8")
  ) as Record<string, number | string[]>;

  const counts = new Map<string, number>();
  for (const v of violations) {
    const key = `${posix}::${v.rule}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const over: string[] = [];
  for (const [key, n] of counts) {
    const allowed =
      typeof baselineRaw[key] === "number" ? (baselineRaw[key] as number) : 0;
    if (n > allowed) {
      over.push(key);
    }
  }
  if (over.length === 0) {
    return 0;
  }

  const lines: string[] = [
    `design-lint: this edit puts ${posix} above its baseline. Fix these before moving on (pnpm lint:design shows the full picture):`,
  ];
  for (const key of over.sort()) {
    for (const v of violations.filter((x) => `${posix}::${x.rule}` === key)) {
      lines.push(`  ${posix}:${v.line} [${v.rule}] ${v.excerpt}`);
    }
  }
  console.error(lines.join("\n"));
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    // fail-open: never block on our own bugs. HOOK_DEBUG=1 surfaces them.
    if (process.env.HOOK_DEBUG) {
      console.error(err);
    }
    process.exit(0);
  });
