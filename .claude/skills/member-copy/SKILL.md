---
name: member-copy
description: Writing or changing ANY user-visible text — labels, buttons, nav, empty states, errors, tooltips, section descriptions, validation, confirmations, notifications, emails? Load this. It carries the voice boundary, every enforceable copy law from lib/contracts/copy.ts with its WHY, the canon 04 UX-writing digest, and worked good/bad examples. System UI is neutral product voice; Chad's harsh voice lives ONLY in chat and his quoted words.
---

# Member-facing copy

Scope: SYSTEM UI — labels, buttons, empty states, errors, tooltips, nav, section descriptions, validation, confirmations, notifications, transactional email. Chad's own words in chat and the weekly report's coaching voice are OUT of scope by owner law (`copy-boundary.md`). This skill is the writer's companion to `lib/contracts/copy.ts` (the machine-checked half, run by `pnpm lint:design`) and canon 04 §11 (UX writing). For the exact final strings on a specific surface, call the `member-copy-writer` advisor.

## The voice boundary (the one rule everything hangs on)
**Chad's harsh, blunt, insulting persona is the product — but it lives ONLY in chat and in his quoted words.** Every button, label, nav item, error, empty state, tooltip, and notification uses a **neutral, clear product voice**: calm, direct, specific, second person "you/your". A joke or insult on a delete confirmation, an invoice, or an error is a category error — members need unambiguous system communication for consequential acts (canon 04 §157–158, canon 07 §118–119). Any change to Chad's behavior/prompts needs explicit owner authorization first (CLAUDE.md).

## Enforced copy laws (from copy.ts) — each with its WHY
These are lint-enforced tripwires; write so you never trip them, and understand why each exists.

- **em-dash** — no em-dashes or en-dashes anywhere in customer-facing copy. Use a comma, colon, or period. (Owner law.)
- **generic-view-all** — links name their destination ("Workout history", "Sleep trends"), never a generic "View all". WHY: information scent; a screen-reader user and a scanner both need to know where a link goes (canon 04 §140, canon 02 §31).
- **negation-contrast** — banned AI-slop shape "it's not X, it's Y" / "it was never X. It was Y". State the claim directly. (Owner s161.)
- **snark-marker** — system UI never insults, shames, or performs toughness (no "no excuses", "pathetic", "lazy", "actually showed up"). WHY: that register is Chad's quoted voice only; system chrome is neutral (voice boundary, canon 07 §118).
- **moral-grading** — system UI does not morally grade food, sleep, or body data ("cheat day", "guilty", "shameful", "be honest with yourself"). Adherence is relative to explicit targets, never moralized (canon 08 A engagement ethics; no shame §6/§34).
- **false-certainty** — no unsupported certainty about muscle/strength/recovery/health ("you will lose muscle", "guaranteed way to lose"). Claims need coverage (`lib/contracts/claims.ts`).
- **anthropomorphic-knowing** — system UI does not claim to know intent ("the app knows you"). State what the data shows (canon 07 §86 scope competence to grounding).
- **we-voice** — copy never says "we/us/our" in a sentence: there is no anonymous team behind the curtain judging the member (flaws SYS-10). Attribute estimates/content to Chad, or state them plainly. WHY: "we" implies a hidden org watching you.
- **gym-assumption** — never assume the member trains in a gym ("at the gym", "your gym's") — many train at home (flaws SYS-11).
- **jargon-domain** — "domain" is internal jargon; name the actual areas: training, nutrition, sleep, weight (flaws PRG-03).
- **jargon-internal-phrase** — no raw internal analysis phrasing ("trend-smoothed", "all loaded history"); say what it means in plain words (flaws TRN-24/29).
- **device-verb** — device-agnostic verbs only: "select" or "choose", never "tap" or "click". WHY: the copy can't know whether the member is on a phone or a desktop (Microsoft Style Guide; canon 05 §112 device-neutral).
- **exclamation-copy** — no exclamation marks in system UI copy: calm, direct tone (canon 04 §134). Chad's chat voice is exempt by owner law.
- **generic-error** — errors never open with "Something went wrong" / "An error occurred": that answers neither what happened nor what to do (canon 03 §44, canon 04 §133, NN/g). Name what failed and the way forward.
- **session-vocab** — member-facing vocabulary is "workout", never "session" (owner ruling, flaws SYS-14).

## Positive laws (what good copy looks like) — from copy.ts SYSTEM_COPY_RULES
- **instantly-clear-labels** — every label is instantly self-explanatory; prefer the explicit two-word name ("Manual Entry", not "Manual"). If a member could ask "what does this do?", it fails (canon 04 §145, canon 02 §31).
- **cta-verb-object** — CTAs are verb + object and name their destination when navigating: "Log meal", "Start a workout", "Open meal plan", "Sleep trends" (canon 04 §128).
- **units-in-labels** — field labels carry the unit ("Amount (oz)"), never only the placeholder; placeholders show an example, not instructions (canon 01 §30, §C; canon 04 §137).
- **numbers-say-what-they-are** — every displayed number states unit, period, and target basis ("1,840 of 2,300 kcal", "4 of 7 days logged") via `lib/contracts/units.ts` formatters (canon 04 §93, §143; canon 08 §91).
- **errors-keep-data-no-blame** — errors never blame and never lose input: "We couldn't save your sleep entry. Your values are still here. Try again." (canon 03 §44–46, §50). [Note: attribute to Chad or state plainly — don't literally ship "we"; see we-voice.]
- **destructive-confirms-name-the-object** — "Delete the Jul 6 weigh-in of 205.8 lb? This will update your trend." (canon 01 §131, canon 03 §111).
- **estimates-labeled** — derived values are labeled ("Trend weight", "est. 1RM"); smoothing/formula named at detail level (canon 08 §98).
- **missing-said-plainly** — missing data reads "Not logged", never "0", never a judgment.

## Canon 04 §11 UX-writing digest (the craft under the laws)
Sentence case for UI text (§127). CTAs verb-first + specific, never Submit/OK/Click here (§128). Front-load every string, first ~2 words carry meaning (§129). Cut word count ruthlessly, no "please note"/"in order to" (§130). Numerals not words (§131). One term per concept everywhere (§132). Errors say what/why/what-next in human language (§133). Calm tone, no alarmist words for routine errors (§134). Confirm dialogs name the object + consequence, buttons repeat the verb (§135). Empty states teach: what this is / why it's empty / what to do (§136). Placeholder is not a label (§137). Address the user as "you"; never mix my/your — pick "your" (§138). Active voice, present tense (§139). Links say where they go (§140). No string concatenation / bake-in plurals; ICU MessageFormat (§141). Leave room for localization expansion (§142). Locale formatters for numbers/dates/currency (§143). Relative timestamps for recency, absolute on demand (§144). Match the user's vocabulary (§145). Anticipate anxiety at commitment (§146). Success feedback brief + quiet (§147).

## Worked good/bad (from the flaw history)
| Bad | Good | Law |
|---|---|---|
| "Tap here to log" | "Log meal" | device-verb, cta-verb-object |
| "Something went wrong" | "Chad couldn't save your sleep entry. Your values are still here. Try again." | generic-error, errors-keep-data-no-blame |
| "View all" | "Workout history" | generic-view-all |
| "Session complete!" | "Workout saved" | session-vocab, exclamation-copy |
| "0 g protein" (when unlogged) | "Not logged" | missing-said-plainly |
| "Manual" | "Manual Entry" | instantly-clear-labels |
| "We think you skipped leg day." | "No workout logged since Monday." | we-voice, snark-marker |
| "Cheat day?" | "1,840 of 2,300 kcal" | moral-grading, numbers-say-what-they-are |
| "Delete" (bare, on a bulk action) | "Delete all 12 weigh-ins" | canon 01 §132, §149 (scope in the label) |

## Naming decisions that bind (design north star + decision log)
Workouts (not Sessions/Training-log), Home (not Dashboard), "<Category> History" (Workout History, Sleep History), second person "your". Same action = same name on every surface.

## Binding instruction
Before writing member-facing strings, apply the voice boundary and the laws above; run `pnpm lint:design` (it enforces copy.ts). For the exact final strings on a surface, call the `member-copy-writer` advisor — it returns strings with each law/canon principle cited. Read canon 04 §11 and canon 03 §6 (errors) / §7 (empty states) in full for any non-trivial copy surface. An uncited copy decision is invalid.
