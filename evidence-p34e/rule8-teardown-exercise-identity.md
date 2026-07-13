# FIX-34 Rule 8 teardown: canonical exercise identity (Hevy / Strong benchmark)

| Field | Value |
|---|---|
| Session | P34-E (dashboard-overhaul Phase 3/4 wave) |
| Task | FIX-34 canonical exercise identity with alias preview |
| Benchmark class | Data-model design teardown (briefing rule 8, data-layer form: written teardown, not screenshots) |
| References ranked | 1. Hevy (public API exposes the identity model directly), 2. Strong (CSV export + merge tooling docs), 3. (fallback) Jefit/Boostcamp if primary sources are thin |
| Why this ranking | Hevy is the category leader for social lifting logs and the ONLY one with a public, documented API, which makes its identity model inspectable rather than inferred; Strong is the longest-lived pure lifting logger and the originator of the merge-duplicates flow most apps copy. Both are named in the packet as the canonicalization bar. |
| Written | 2026-07-13 |

## Part 1: Chad's current identity model (as-built, pre-FIX-34)

Mapped from source this session:

- **Identity primitive: the exercise NAME, trimmed + lowercased.** There is no exercise ID anywhere in the logged data path.
  - `WorkoutExercise.exerciseName` (`lib/db/schema.ts:632`) is a text snapshot, deliberately not an FK, "so the log is stable even if a custom exercise is later renamed or deleted".
  - Every stat groups by `ex.name.trim().toLowerCase()`: PRs (`computePersonalRecords`, `lib/workouts/stats.ts:132`), 1RM trends (`exercise1RMTrend`:243), logger ghosts (`lastSetsByExercise`:296), live PR detection (`prBaselineByExercise`:339), PR replay (`prCountsByWorkout`:385).
  - The picker catalog (`components/workouts/v2/catalog.ts`) merges 66 built-ins (`lib/workouts/exercise-library.ts`) with `CustomExercise` rows; customs WIN name collisions.
  - Exercise detail URLs are `encodeURIComponent(name)` (`catalog.ts:exerciseSlug`).
  - Lift goals suggest from `distinctExerciseNames` and read baselines from `prBaselineByExercise`; both name-keyed (`lib/goals/form-data.ts`).
- **The defect (FIX-34):** any spelling variant is a new identity. "Bench Press" logged by Chad's `log-workout` tool vs "Barbell Bench Press" picked from the library = two PR rows, two trend lines, split records. Free-text entry paths (AI tool logging, custom exercises, plan prefill) make variants common.
- **What is GOOD about the current model and must survive:** the snapshot property (history never mutates when a library entry changes), custom exercises as first-class, case-insensitive matching already everywhere (one consistent convention to hook into).

## Part 2: How the leaders do it (research pass, 2026-07-13)

Full sourced report below in the Appendix; the load-bearing findings:

1. **Hevy: stable string ID, name as label.** The public API's `ExerciseTemplate` has an opaque string `id` (e.g. `b459cba5-cd6d-463c-abd6-54f8eafcadcb`) separate from `title` ("Bench Press (Barbell)"); logged exercises reference `exercise_template_id`, not the name. Renames are free; records never split on wording. Corroborated: Hevy OpenAPI spec + help center.
2. **Strong: name IS the portable identity.** Strong's CSV export has no ID column; `Exercise Name` is the only handle. Internally each exercise (built-in or custom) is an entity with its own Records tab.
3. **Movement x equipment is the atomic entity in BOTH**, with the equipment baked into the display name as a parenthesized suffix ("Squat (Barbell)", "Bench Press (Dumbbell)"). Neither models "one movement, many equipment attributes"; each variant keeps separate records. Hevy ALSO keeps a structured `equipment` field alongside the pre-composed name.
4. **Custom exercises are first-class entities** (own IDs, `is_custom: true` in Hevy; 7 free / unlimited Pro quota). Hevy's creation nudge is "duplicate a built-in and edit". Neither app can link a custom to a built-in after the fact.
5. **Merge tooling: Strong has it, Hevy does not.** Strong's "Transfer Exercise Data" (Edit Exercise page) folds one exercise's history into another, same-category only, user-initiated, **irreversible, no preview**, record-recompute semantics undocumented. Hevy has NO merge/replace-in-history path at all; once two IDs exist, the split is permanent.
6. **Records are computed per exercise entity** (per ID in Hevy, per named entity in Strong): best set per rep count, estimated 1RM, best session volume. Rename preserves records in both (Strong restricts rename to customs).
7. **Neither app warns or blocks on duplicate names at creation.** Both rely on curated libraries and (Strong) post-hoc merging.

## Part 3: Side-by-side grade (ours vs the bar)

| Decision | Hevy | Strong | Chad pre-FIX-34 | Chad post-FIX-34 | Grade |
|---|---|---|---|---|---|
| Identity primitive | Stable opaque ID; name is a label | Name (in export); entity internally | Lowercased name only | Lowercased name + stable canonical slug per built-in + durable alias layer resolving variants to one canonical identity | MATCH (Hevy's lesson, adapted additively) |
| Movement x equipment atomicity | Separate entity per variant | Separate entity per variant | One flat name per variant (accidental match) | Preserved explicitly: curated aliases NEVER fold across equipment (no "barbell shrug" into the dumbbell Shrug); tests enforce no built-in folds into another | MATCH |
| Custom exercises | First-class, own ID, custom wins | First-class | First-class rows; customs win name collisions in the picker | Unchanged AND alias-protected: a name matching the member's own custom exercise is never alias-folded | MATCH |
| Merge tool | NONE (permanent splits) | Irreversible, no preview, recompute undocumented | None | Previewed merge: per-member what-merges-into-what + before/after PR reconciliation, owner-approved before anything applies, resolution-at-read (no row rewrites) so it is reversible by design | EXCEED (beats both leaders) |
| Records semantics | Per ID | Per entity | Per raw name (splits) | Per canonical identity; reconciliation = max across merged variants, proven in unit tests | MATCH |
| Duplicate prevention at creation | None documented | None documented | None | Identity module exports `resolveExerciseIdentity` for the picker/custom-form to adopt (UI wiring queued; outside P34-E territory) | EXCEED (foundation laid; both leaders lack it) |

## Part 4: Design implications adopted for FIX-34

1. **Stable identity handle:** every built-in gets a stable `canonicalSlug` (kebab-case, never re-derived from a mutable label at consumption time). Plans (P34-D), analytics (P5/FIX-33), and the alias table reference this handle or the canonical display name, never the raw logged string.
2. **Alias layer, resolution at read time:** a curated alias map (code, versioned, testable) + an `ExerciseAlias` DB table for member-scoped and approved-global mappings. Resolution happens when stats group exercises, NOT by rewriting `WorkoutExercise` rows; history snapshots stay authoritative (rule 6: no rewrites this wave; also makes every merge reversible, beating Strong).
3. **Conservative curated set with confidence tiers:** high-confidence spelling/shorthand variants only ("bench press" → "Barbell Bench Press", "ohp" → "Overhead Press"); anything equipment-ambiguous ("shoulder press", "chest fly", "tricep extension") is EXCLUDED. Structural safety invariants are unit-tested: no alias key collides with a built-in name, no alias maps a built-in onto another built-in, unknown names always resolve to themselves.
4. **Custom exercises are sacred:** the resolver takes the member's custom-exercise names as an exclusion set; a logged name matching a member's custom is never folded. The preview lists "custom shadows a built-in" cases as informational only.
5. **Owner-gated apply:** the merge preview (what merges into what, affected exercise rows and PR deltas per member) is a generated artifact queued for OWNER APPROVAL. Nothing resolves through aliases on live member surfaces until approval; the wiring of consumers is P5 (FIX-33) work.

## Appendix: full sourced research report

*(Delegated research pass, Opus agent, 2026-07-13. Claims cross-checked across two or more sources where possible; single-sourced/inferred items flagged.)*

### Q1. Identity primitive: ID vs name

**Hevy; stable string ID from a built-in library.** The Hevy public API (`api.hevyapp.com/docs`) models an `ExerciseTemplate` with a distinct `id` separate from its `title`:

```json
ExerciseTemplate {
  "id":    { "type": "string", "example": "b459cba5-cd6d-463c-abd6-54f8eafcadcb" },
  "title": { "type": "string", "example": "Bench Press (Barbell)" },
  "type":  { "type": "string", "example": "weight_reps" },
  "primary_muscle_group": { "type": "string", "example": "chest" },
  "secondary_muscle_groups": { "type": "array" },
  "is_custom": { "type": "boolean", "example": false }
}
```

Inside a logged workout, each exercise references the library entry by ID (`"exercise_template_id": "05293BCA"`), not name. The canonical identity is the template id; `title` is a denormalized label. (One secondary wrapper described `id` as an integer; the authoritative OpenAPI schema says string.)

**Strong; name is the identity in the export.** Strong's CSV has no exercise ID column: `Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps, Distance, Seconds, Notes, Workout #` (single-sourced header order via third-party importer teardowns). The only exercise handle is free-text `Exercise Name` ("Squat (Barbell)", "Face Pull (Cable)"). Strong CSVs cannot be re-imported into Strong.

### Q2. Built-in library structure

Hevy: 400+ built-ins, each with structured `type` (`weight_reps`, `reps_only`, `distance`, `duration`, `weight_distance`), `equipment`, primary/secondary muscle groups. Strong: low hundreds (exact count unpublished; sibling StrongLifts states "over 100", secondary source). **Equipment variant = separate exercise in both**, named with a parenthesized equipment suffix on the base movement. Neither resolves equipment from a normalized field at display time; the name is pre-composed.

### Q3. Custom exercises

Hevy: Profile > Exercises > Create (image, name, equipment, muscle groups, type) or duplicate-a-built-in; distinct entities, `is_custom: true`; API `POST /v1/exercise_templates` (no PUT/DELETE in the public API); quota 7 free / unlimited Pro. No path to later link/merge a custom to a built-in. Strong: Exercises tab > New, also mid-workout; distinct entities with a category (the category gates merges); renameable (customs only).

### Q4. Merge / rename / replace tools

**Strong: "Transfer Exercise Data"** (Edit Exercise page): moves ALL of one exercise's data into another, same-category only, user-initiated, explicitly **irreversible** ("you cannot undo this once you have performed the merge"), **no preview documented**; post-merge record recomputation semantics unpublished (inferred: target absorbs source history). Rename is customs-only. **Hevy: no documented merge or replace-in-history tool** in the API or help center (create/edit/duplicate/delete only). Rename does not split records (ID-keyed), but two distinct IDs can never be reunited.

### Q5. PR / records semantics

Both compute records per exercise entity. Strong's Exercise Detail Records tab: all-time bests, best per rep count, projected 1RM curve; PR celebration notifications. Hevy: records (heaviest weight, best 1RM estimate, best set volume) keyed to `exercise_template_id`; API exposes set history by template id. Rename preserves records in both.

### Q6. Duplicate prevention

Neither app documents any duplicate-name warning or block at creation. Hevy mitigates indirectly via the duplicate-a-built-in creation path. (Absence confirmed across help articles for both.)

### Sources

Hevy: OpenAPI spec via github.com/chrisdoc/hevy-mcp `openapi-spec.json`; api.hevyapp.com/docs; help.hevyapp.com articles 35688251991575 (exercise library, 400+), 34264544382615 (create/edit/duplicate customs), 38001424401943 (Strong CSV import); hevyapp.com/features/custom-exercises.
Strong: help.strongapp.io articles 209 (merge data between two exercises), 237 (Exercise Detail / Records tab), 97 (create custom exercises), 235 (export), category 96 (exercises); blog.ayjc.net/posts/strong-app-parsing (CSV columns, naming); rep-stack.com/import/strong-csv; strengthjourneys.xyz/import/strong.
Secondary: support.stronglifts.com/article/128-exercises; Strong on the App Store (PR notifications).
