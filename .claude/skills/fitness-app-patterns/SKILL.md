---
name: fitness-app-patterns
description: Building or changing any workout, nutrition, sleep, or weight surface — set-row logging, exercise pickers, rest timers, reorder, workout finish/discard, meal/food logging, weigh-in entry, history/records? Load this. It carries the Hevy/Strong/MyFitnessPal conventions members already know, and tells you to pull real screens via Mobbin when the pattern at hand isn't covered here. Copy the leading apps; inventing a mechanism none of them use needs owner approval first.
---

# Fitness-app conventions (Hevy / Strong / MyFitnessPal)

Members arrive already fluent in the category leaders. Jakob's Law binds hard here: a workout logger that logs sets differently from Hevy and Strong is not "fresh," it is broken muscle memory. This skill carries the converged conventions from the S0 research (`s0-ux-guardrails-proposal.md` appendix + `s0-ux-guardrails-round3-canon.md`). It sits ON TOP of the domain canon skills (01 interaction, 02 flows, 03 feedback) — those still apply; this names the domain-specific defaults.

Triggers on any workout / nutrition / sleep / weight surface work.

## The converged conventions (copy these; don't reinvent)

**Set-row logging.**
- A logged set is a row: set number, target/previous values, the inputs (weight, reps), and a completion checkmark. Tapping the checkmark marks the set done. This is the Hevy/Strong model; match it. (canon 01 §61 preselect-on-focus, §38 tap-to-type, §W.182 ghost values.)
- **Ghost previous-set values**: show last time's weight/reps faintly in the row as a suggestion until the member confirms or edits — never silently log stale numbers as new truth (canon 01 §182).
- Numeric fields use `inputmode="numeric"`/`decimal`, preselect content on focus, and never fight paste (canon 01 §33, §61, §35).

**Rest timer.**
- Auto-starts on set completion; the fitness-logger norm (Strong default ~2:00), **no modal** — it just begins and visibly announces itself starting (canon 03 §136 auto-start announces itself, §129 live controls).
- Live controls: pause, skip, and extend (+15/+30s) as visible one-tap controls, without restart (canon 03 §129). Cancel-and-recreate as the only adjustment is a defect.
- Derives from wall-clock timestamps, survives backgrounding/lock, correct-on-return incl. completed (canon 03 §126–127, §132 wake lock). Auto-start is one toggle to disable (canon 03 §136).

**Reorder exercises.**
- Menu → drag-handle screen. Reorder is offered via a menu action that opens a dedicated reorder screen with visible drag handles, plus a keyboard/menu alternative (canon 01 §129, §123 WCAG 2.5.7). Whole-row drag fights scrolling — don't.

**Discard / finish a workout.**
- **Explicit Discard with confirmation**: discarding an in-progress workout is a destructive action → a confirmation naming what's lost ("Discard this workout? Your 4 logged sets will be deleted."), verb+object buttons, safe option focused (canon 01 §131–132, canon 03 §111). Finishing is the safe primary path.
- Finish flow confirms what was saved and returns to a sensible place (canon 02 §90).

**Edit scope: structural vs value.**
- **Structural changes prompt for scope; value edits save silently.** Editing a routine's structure (adding/removing/reordering exercises on a template used by future workouts) prompts "apply to this workout only / update the routine" — the recurring-item scope prompt (canon 01 §167). Correcting a value on today's logged set (a mistyped weight) saves silently in place (canon 01 §I commit models, canon 03 §32 no redundant toast).

**Pickers & search.**
- Exercise / food pickers are searchable comboboxes (long lists), typo-tolerant, full-width bottom sheets on mobile — not tiny dropdowns (canon 01 §74, §78; canon 02 §6 search).
- MyFitnessPal food search: prominent search bar, recents/frequents on focus, large tap targets, quick-add always thumb-reachable (canon 02 §65, canon 01 §L thumb zone).

**Records, history, dashboards.**
- PRs detected + surfaced automatically at the moment they happen; always-accessible records page per category; recalc on edited/deleted data (canon 08 §47–48, §51).
- History lists group under sticky date buckets, front-load the differentiating info, restore scroll position on back (canon 08 §73, §70, §67).
- Weight/volume/recovery are trend quantities — sparkline beside the number, full chart in drill-down; state the period on every metric (canon 08 §96, §91).

**Weigh-in / sleep / calorie entry.**
- Duration (sleep, rest) uses a labeled mm:ss / h:mm pattern echoed back in words; never a bare free-text field (canon 01 §157, §161). Weight honors the unit setting everywhere, stored canonically (canon 01 §170).
- Missing data reads "Not logged", never "0", never a judgment (member-copy skill; copy.ts `missing-said-plainly`).

## When the pattern here isn't covered → pull real screens

For any interaction this skill and the canon don't settle, **look at how Hevy, Strong, or MyFitnessPal actually does it via Mobbin** before deciding:
- `mcp__mobbin__search_screens` — real screenshots of a specific surface (e.g. "Hevy rest timer", "Strong exercise picker").
- `mcp__mobbin__search_flows` — the whole flow (e.g. "MyFitnessPal log food").
- `mcp__mobbin__search_sections` — a UI section pattern.

Copy the convention you find. **A mechanism no mainstream fitness app uses requires owner approval first** (owner law, CLAUDE.md §5). Deciding a fitness interaction from imagination is a defect even if it looks fine (CLAUDE.md convention-lookup mandate). If Mobbin has no reference and the canon is silent, recommend asking the owner rather than inventing.

## Voice boundary reminder
Chad's harsh voice lives ONLY in chat and his quoted words. Every button, label, empty state, error, and timer control on these surfaces uses neutral, clear product voice (canon 07 §118; load the `member-copy` skill for any string). Member vocabulary: "workout" not "session"; "Workouts", "Home", "<Category> History"; second person "your" (design north star + decision log).

## Binding instruction
Before building a fitness surface, load the relevant domain canon skill(s) and Read the owning canon sections; then apply the conventions above. New surface → also pull the leading-app reference on Mobbin and cite it. Every spec traces to a canon principle number, a named convention here, or a real-app Mobbin reference — an uncited interaction decision is invalid.
