// P56-D FIX-41 attribution helper. NOT a measurement script: it consumes the
// preserved measurement's output (scripts/p34z-perf-today.mjs ->
// perf-run-output.json) and attributes each first-load chunk to the libraries
// it carries, by fetching the chunk from the running prod server and matching
// distinctive source signatures that survive minification.
//
// Usage: node scripts/p56d-attribute-chunks.mjs <perf-run-output.json> [base]
import { readFileSync } from "node:fs";

const jsonPath = process.argv[2];
const BASE = process.argv[3] ?? "http://localhost:3601";
if (!jsonPath) {
  throw new Error("usage: node p56d-attribute-chunks.mjs <perf-run-output.json> [base]");
}
const run = JSON.parse(readFileSync(jsonPath, "utf8"));
const js = Array.isArray(run.results)
  ? run.results.find((r) => r.viewport && r.jsFiles) ?? run.results[0]
  : null;
// The measurement stores the full file list per run; fall back to topChunks.
const files =
  js?.jsFiles ??
  run.summary?.topChunks ??
  run.results?.[0]?.summary?.topChunks ??
  [];
if (files.length === 0) {
  throw new Error("no chunk list found in the measurement output");
}

// Signatures that survive minification (string literals / unique tokens).
const SIGNATURES = [
  ["react-dom", ["react-dom", "Minified React error", "__DOM_INTERNALS"]],
  ["react", ["react.production", "Fragment(", "useSyncExternalStore"]],
  ["next-runtime", ["__next_app__", "next_router", "app-router", "segment"]],
  ["recharts", ["recharts", "CartesianChart", "ResponsiveContainer"]],
  ["d3-*(via recharts)", ["d3-shape", "curveCardinal", "d3-scale", "ticks("]],
  ["motion/framer", ["framer", "motionValue", "useReducedMotion", "AnimatePresence"]],
  ["radix-ui", ["radix-ui", "RovingFocusGroup", "DismissableLayer"]],
  ["sonner", ["sonner", "data-sonner-toast"]],
  ["lucide", ["lucide", "createLucideIcon"]],
  ["next-auth", ["next-auth", "authjs", "getCsrfToken"]],
  ["swr", ["useSWR", "swr/"]],
  ["vaul(drawer)", ["vaul", "data-vaul"]],
  ["zod", ["ZodError", "z.object", "invalid_type_error"]],
  ["date logic", ["Intl.DateTimeFormat", "timeZone:"]],
  ["streamdown/markdown", ["remark", "rehype", "micromark"]],
];

const out = [];
for (const f of files) {
  const name = f.f ?? f.name ?? f;
  const url = `${BASE}/_next/static/chunks/${name}`;
  let text = "";
  try {
    const res = await fetch(url);
    if (!res.ok) {
      // App chunks can live under nested paths; try the app dir form.
      const res2 = await fetch(`${BASE}/_next/static/chunks/app/${name}`);
      text = res2.ok ? await res2.text() : "";
    } else {
      text = await res.text();
    }
  } catch {
    text = "";
  }
  const hits = text
    ? SIGNATURES.filter(([, sigs]) => sigs.some((s) => text.includes(s))).map(
        ([lib]) => lib
      )
    : ["(fetch failed)"];
  out.push({ chunk: name, gzipKb: f.kb ?? null, libs: hits.join(", ") });
}
out.sort((a, b) => (b.gzipKb ?? 0) - (a.gzipKb ?? 0));
console.table(out);
