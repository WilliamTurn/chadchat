/**
 * SYSTEM-MICROCOPY CONTRACT (DSH-66 / Phase 1), the machine-readable half of
 * copy-boundary.md. That document states the policy (which voice belongs
 * where); this module encodes the enforceable parts so tests and future copy
 * linters can run them against actual strings.
 *
 * Scope: SYSTEM UI ONLY (labels, buttons, empty states, errors, tooltips,
 * nav, section descriptions, validation, confirmations). Chad's own words in
 * chat and the weekly report's coaching voice are OUT of scope by owner law;
 * see copy-boundary.md.
 */

export type CopyViolation = {
  ruleId: string;
  reason: string;
  /** The offending excerpt. */
  match: string;
};

type BannedPattern = {
  id: string;
  pattern: RegExp;
  reason: string;
};

/**
 * Tripwire patterns for system microcopy. Deliberately high-precision, not
 * exhaustive: these catch the recurring offender classes from the audits
 * without false-positive noise. The policy doc governs everything else.
 */
export const SYSTEM_COPY_BANNED: readonly BannedPattern[] = [
  {
    id: "em-dash",
    // Written as escapes so the banned characters never appear in source.
    pattern: new RegExp("\\u2014|\\u2013"),
    reason:
      "Owner law: no em-dashes (or en-dashes) anywhere in customer-facing copy. Use a comma, colon, or period.",
  },
  {
    id: "generic-view-all",
    pattern: /\bview all\b/i,
    reason:
      "Links name their destination ('Workout history', 'Sleep trends'), never a generic 'View all'.",
  },
  {
    id: "negation-contrast",
    pattern: /\b(?:it'?s not [^.!?]{2,40}, it'?s|it was never [^.!?]{2,40}\. it was)\b/i,
    reason:
      "The negation-contrast pattern is banned AI slop (owner s161). State the claim directly.",
  },
  {
    id: "snark-marker",
    pattern:
      /\b(no excuses|bothered to|pathetic|abysmal|massive failure|freeload|lazy|actually show(?:ed)? up)\b/i,
    reason:
      "System UI never insults, shames, or performs toughness. That register belongs to Chad's own quoted words only.",
  },
  {
    id: "moral-grading",
    pattern: /\b(cheat(?:ed|ing)? (?:day|meal)|guilty|shame(?:ful)?|be honest with yourself)\b/i,
    reason:
      "System UI does not morally grade food, sleep, or body data. Adherence is relative to explicit targets.",
  },
  {
    id: "false-certainty",
    pattern:
      /\b(you (?:will|are going to) (?:absolutely |definitely )?lose (?:muscle|strength)|guaranteed (?:recipe|way) (?:for|to) los)\b/i,
    reason:
      "No unsupported certainty about muscle, strength, recovery, or health. Claims need coverage (lib/contracts/claims.ts).",
  },
  {
    id: "anthropomorphic-knowing",
    pattern: /\b(?:the app|chad) knows (?:you|what you)/i,
    reason:
      "System UI does not claim to know intent. State what the data shows.",
  },
  {
    id: "we-voice",
    // "we/us/our" inside a quoted, sentence-like string (must contain a
    // space). There is no team behind the curtain: the product speaks as
    // Chad or not at all (flaws SYS-10, owner 2026-07-15).
    pattern:
      /(["'`])(?=[^"'`]* )[^"'`]*\bwe(?:'re|'ll|'ve)?\b[^"'`]*\1/i,
    reason:
      "Copy never says 'we': it implies an anonymous team judging the member (flaws SYS-10). Attribute estimates and content to Chad, or state them plainly.",
  },
  {
    id: "gym-assumption",
    pattern: /\b(?:at the gym|your gym'?s|any gym day)\b/i,
    reason:
      "Copy never assumes the member trains in a gym (flaws SYS-11). Many train at home.",
  },
  {
    id: "jargon-domain",
    // Quoted, sentence-like strings only, so identifiers and route code stay
    // legal (same shape as session-vocab below).
    pattern:
      /(["'`])(?=[^"'`]* )[^"'`]*\bdomains?\b(?![.}\w])[^"'`]*\1/i,
    reason:
      "'domain' is internal jargon members do not know (flaws PRG-03). Name the actual areas: training, nutrition, sleep, weight.",
  },
  {
    id: "jargon-internal-phrase",
    pattern: /\b(?:trend[- ]smoothed|all loaded history)\b/i,
    reason:
      "Internal analysis phrasing shown raw to members (flaws TRN-24/TRN-29). Say what it means in plain words.",
  },
  {
    id: "session-vocab",
    // Quoted, sentence-like strings only (must contain a space), so route
    // paths ("/workouts/session") and identifiers stay legal. The lookaround
    // guards skip template-literal interpolations like `${session.name}`.
    pattern:
      /(["'`])(?=[^"'`]* )[^"'`]*(?<!\$\{)\bsessions?\b(?![.}\w])[^"'`]*\1/i,
    reason:
      "Member-facing vocabulary is 'workout', never 'session' (owner ruling, flaws SYS-14).",
  },
] as const;

/** Scan one system-UI string; returns every violation found. */
export function findBannedCopy(text: string): CopyViolation[] {
  const out: CopyViolation[] = [];
  for (const rule of SYSTEM_COPY_BANNED) {
    const m = rule.pattern.exec(text);
    if (m) {
      out.push({ ruleId: rule.id, reason: rule.reason, match: m[0] });
    }
  }
  return out;
}

/* --------------------------------------------------------------------------
 * Positive rules (what good system microcopy looks like)
 *
 * These are review-checkable requirements; the wording examples are the
 * approved forms from the audit copy system (doc 05) and the labels law.
 * ------------------------------------------------------------------------ */

export const SYSTEM_COPY_RULES = [
  {
    id: "instantly-clear-labels",
    rule: "Every label is instantly self-explanatory; prefer the explicit two-word name ('Manual Entry', not 'Manual'). If a member could ask 'what does this do?', it fails.",
  },
  {
    id: "cta-verb-object",
    rule: "CTAs are verb + object and name their destination when they navigate: 'Log meal', 'Start a workout', 'Open meal plan', 'Sleep trends'.",
  },
  {
    id: "units-in-labels",
    rule: "Field labels carry the unit ('Amount (oz)'), never only the placeholder. Placeholders show an example, not instructions.",
  },
  {
    id: "numbers-say-what-they-are",
    rule: "Every displayed number states unit, period, and target basis ('1,840 of 2,300 kcal', '4 of 7 days logged'), via lib/contracts/units.ts formatters.",
  },
  {
    id: "errors-keep-data-no-blame",
    rule: "Errors never blame and never lose input: 'We couldn't save your sleep entry. Your values are still here. Try again.'",
  },
  {
    id: "destructive-confirms-name-the-object",
    rule: "Destructive confirmations name the exact object and the consequence: 'Delete the Jul 6 weigh-in of 205.8 lb? This will update your trend.'",
  },
  {
    id: "estimates-labeled",
    rule: "Derived values are labeled ('Trend weight', 'est. 1RM'); smoothing or formula named at detail level.",
  },
  {
    id: "missing-said-plainly",
    rule: "Missing data reads 'Not logged', never '0', never a judgment.",
  },
] as const;
