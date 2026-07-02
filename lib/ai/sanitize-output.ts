// BLK-3 — Strip Chad's internal reasoning + tool plumbing from user-visible text.
//
// Some gateway-proxied models (notably Gemini 3.1 Pro, Chad's default brain)
// occasionally leak their internal "thinking" channel straight into the visible
// text stream when they're about to call a tool: raw control tokens (e.g.
// `<ctrl94>`), a chain-of-thought preamble, and verbatim tool-definition
// scaffolding that repeats our internal tool names ("CRITICAL INSTRUCTION 1…",
// "default_api:savePlan: Saves a full training or diet plan…",
// "createDocument: Creates an artifact…", "I will use default_api:savePlan…").
//
// None of that should ever reach the user or the saved transcript — it looks
// broken, leaks internal tool names, and screams "thin GPT wrapper." This module
// removes it. It is deliberately conservative: it only strips content it can
// confidently identify as model internals, so genuine coaching prose is left
// untouched. Applied both server-side before persisting (chat route `onFinish`)
// and client-side at render time (`sanitizeText`), so the leak never lands in
// the database and never paints on screen.

// Special / control tokens that must never appear in visible output. Covers
// Gemini's `<ctrl94>`-style turn markers, the older `<has_function_call>` leak
// we already stripped, and the generic thought / tool-call wrappers.
const CONTROL_TOKEN_RE =
  /<\/?(?:ctrl\d+|unused\d+|has_function_call|tool_call|tool_code|thought|reasoning|start_of_turn|end_of_turn|eos|bos)>/gi;

// When the gateway drops only the leading `<ctrl`, a bare numeric tail leaks,
// e.g. `…94>thought CRITICAL INSTRUCTION…`. Remove the whole orphaned delimiter.
const BARE_THOUGHT_DELIM_RE = /\b\d{1,4}>thought\b/gi;

// The internal tool names Chad can call. These identifiers never legitimately
// appear in coaching prose — Chad talks about "your plan", never "savePlan".
const TOOL_NAMES =
  "createDocument|updateDocument|editDocument|requestSuggestions|saveGoal|savePlan|generateMealPlan|logWorkout|logMeal|logWater|logSleep|logWeighIn|getDashboard";

// Fingerprints of a leaked chain-of-thought / tool-selection block. The leak is
// the model reasoning out loud about which internal tool to call before it
// answers, so it is the only place these identifiers ever show up.
const INTERNAL_MARKERS: RegExp[] = [
  /CRITICAL INSTRUCTION/gi,
  /default_api\s*[:.]\s*\w*/gi,
  // Tool-definition lines the model echoes back: "createDocument: Creates an…".
  new RegExp(`\\b(?:${TOOL_NAMES})\\s*:`, "gi"),
  // The decision sentence: "I will use default_api:savePlan", "I'll call savePlan".
  new RegExp(
    `\\bI(?:'ll| will| am going to| need to| should| must)\\s+(?:use|call|invoke)\\b[^\\n.]*?\\b(?:default_api|${TOOL_NAMES})\\b\\w*`,
    "gi"
  ),
];

// A line is unambiguously leaked internals if it still names one of these after
// the preamble cut. Used as a final safety net (drops the whole offending line).
const LEAKED_LINE_RE = new RegExp(
  `(?:CRITICAL INSTRUCTION|default_api\\s*[:.]|\\b(?:${TOOL_NAMES})\\s*:)`,
  "i"
);

function lastInternalMarkerEnd(text: string): number {
  let end = -1;
  for (const re of INTERNAL_MARKERS) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null = re.exec(text);
    while (match !== null) {
      end = Math.max(end, match.index + match[0].length);
      if (match.index === re.lastIndex) {
        re.lastIndex++;
      }
      match = re.exec(text);
    }
  }
  return end;
}

// Remove a leaked chain-of-thought / tool-plumbing preamble. The leak always
// precedes the genuine reply (the model thinks, then answers), so we cut from
// the start of the message through the end of the leaked region and resume at
// the start of the real answer (the next paragraph break, else sentence end).
function stripLeakedPreamble(text: string): string {
  const lastEnd = lastInternalMarkerEnd(text);
  if (lastEnd === -1) {
    return text;
  }

  const after = text.slice(lastEnd);

  const paragraphBreak = after.search(/\r?\n\s*\r?\n/);
  if (paragraphBreak !== -1) {
    return after.slice(paragraphBreak).replace(/^\s+/, "");
  }

  const sentenceEnd = after.search(/(?<=[.!?])\s+/);
  if (sentenceEnd !== -1) {
    return after.slice(sentenceEnd).replace(/^\s+/, "");
  }

  // No boundary after the last marker → the whole message was scaffolding with
  // no real answer following it. Drop it entirely rather than leak a fragment.
  return "";
}

export function stripModelInternals(text: string): string {
  if (!text) {
    return text;
  }

  let out = text.replace(CONTROL_TOKEN_RE, "").replace(BARE_THOUGHT_DELIM_RE, "");
  out = stripLeakedPreamble(out);

  // Safety net: drop any residual line that still names internal plumbing. After
  // the preamble cut this almost never fires; it guarantees the forbidden tokens
  // can never survive even if the leak shape is unusual.
  if (LEAKED_LINE_RE.test(out)) {
    out = out
      .split("\n")
      .filter((line) => !LEAKED_LINE_RE.test(line))
      .join("\n");
  }

  return out.replace(/\n{3,}/g, "\n\n").replace(/^\s+/, "");
}
