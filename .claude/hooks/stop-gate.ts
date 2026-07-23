/**
 * Stop hook (S0b-1, 2026-07-22): run the fast design lint before the session
 * is allowed to finish. Real violations -> stderr + exit 2 (blocks the stop;
 * Claude Code's built-in consecutive-block cap prevents wedging). Lint only,
 * by owner decision: never unit or browser suites here.
 *
 * FAIL-OPEN BY OWNER DECISION: any internal error (pnpm missing, timeout,
 * crash) exits 0 silently. Only a lint run that actually reports violations
 * may exit 2.
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function main(): number {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

  const run = spawnSync("pnpm", ["lint:design"], {
    cwd: root,
    shell: true,
    encoding: "utf8",
    timeout: 120_000,
  });

  if (run.error || run.status == null) {
    return 0; // could not run at all (missing pnpm, timeout, signal): fail open
  }
  if (run.status === 0) {
    return 0;
  }
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  // Exit 2 only when the lint itself reported violations; any other nonzero
  // exit (config error, crash) fails open.
  if (!output.includes("FAIL ")) {
    return 0;
  }
  const failLines = output
    .split("\n")
    .filter((l) => l.includes("FAIL ") || l.trimStart().startsWith("app") || l.trimStart().startsWith("components") || l.trimStart().startsWith("hooks") || l.trimStart().startsWith("lib"))
    .slice(0, 40);
  console.error(
    `design-lint gate: pnpm lint:design is failing. Fix these before finishing:\n${failLines.join("\n")}`
  );
  return 2;
}

try {
  process.exit(main());
} catch {
  process.exit(0); // fail-open: never block on our own bugs
}
