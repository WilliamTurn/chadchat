# System microcopy vs. Chad's voice (the copy boundary)

Part of the Phase 1 contract layer (DSH-66). Policy document; the enforceable tripwires live in `copy.ts`. Owner law, written down so no future session violates it again.

## The two voices

**1. System UI microcopy.** Labels, buttons, empty states, errors, validation, tooltips, nav labels, section descriptions, confirmations, success toasts, chart captions, coverage notes.

- Voice: clear, calm, instructional, specific, brief. Pro-app plain.
- Benchmarks: Hevy, MacroFactor, Apple Health. If Hevy would not print it on a button, neither do we.
- Never: snark, mic-drops, insults, moral grading, performative toughness, "clever" wordplay, unsupported certainty.
- System UI is never written as Chad performing. A settings label does not have a personality.

**2. Chad's coaching voice.** Chat replies, the weekly report's coaching attitude, check-ins, the roast features.

- **Unchanged. Off-limits.** No session edits Chad's persona, prompt, or harshness without explicit owner authorization first (standing owner rule, 2026-07-05).
- The ONE report rule any session may enforce is data accuracy: a claim must be backed by data that was actually logged (`claims.ts` decides what qualifies). Removing a fabricated claim is a data fix. Softening how Chad talks about real data is a persona change and requires owner authorization.

## The line in practice

| Surface | Voice | Example |
|---|---|---|
| Button on a card | System | `Log meal` |
| Empty state | System | `No meals logged today. Log your first meal to update calories and macros.` |
| Error toast | System | `We couldn't save your sleep entry. Your values are still here. Try again.` |
| Delete confirmation | System | `Delete the Jul 6 weigh-in of 205.8 lb? This will update your trend.` |
| Chat reply | Chad | His call, his words. Not governed here. |
| Weekly report, coverage/facts | System rules apply to the FACTS: numbers, coverage, evidence | `Nutrition was logged 2 of 7 days, so nutrition conclusions are limited.` |
| Weekly report, coaching interpretation | Chad | His attitude stays; his claims must clear `claims.ts`. |

## Grey areas, decided now

- **Ask Chad prompt strings** (the prefilled prompts on cards): system-authored, so system rules apply. They describe the task plainly; they do not perform Chad.
- **Section descriptions** (`SectionBand` description lines): system voice. One plain sentence stating the section's job.
- **The dashboard greeting subtitle**: system voice. (The current "No excuses, just the numbers." line predates this contract; replacing it is a Phase 6 task, flagged, not silently edited in Phase 1.)
- **Locked-card teasers**: system voice describing a capability. Selling energy is fine; snark is not.
- **Celebrations** (PR toast, streak milestones): system voice, warm and specific (`Workout saved. 20 sets, 2 new personal records.`). Chad may ALSO react in chat; that is his voice.

## Hard rules carried from owner law

- No em-dashes anywhere in customer-facing copy.
- No negation-contrast pattern ("It's not X, it's Y").
- Every label instantly self-explanatory (prefer "Manual Entry" over "Manual").
- Missing data reads "Not logged", never "0".
- Copy never scares members with hard usage caps.
- Never undercut the app: no timid hedges ("AI projection", "real-looking"); outputs are calculated/analyzed results.
