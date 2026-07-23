# The UX canon — index (2026-07-22)

> **Living copy. Edits happen HERE; the chadlatest copy is the frozen research artifact (2026-07-22).**

The explicit, enumerated body of virtually-universally-agreed UX principles for building a best-in-category app, researched from the canonical sources (W3C WCAG 2.2 / ARIA APG, Vercel Web Interface Guidelines, Nielsen Norman Group, GOV.UK Design System, Baymard Institute, Apple HIG, Material 3, Refactoring UI, Microsoft HAX, Google PAIR, web.dev) by an eight-agent research team. Every principle: one bolded imperative rule, a plain-English explanation, its source(s), and a tag - [mechanical] (a lint or test can check it) or [judgment] (an auditor must look).

**1,311 principles.** These files are the syllabus for the guardrail skills, the advisor agents, and the auditor checklists (see `../s0-ux-guardrails-proposal.md` rounds 1-3).

Patched 2026-07-22: all MISSING/THIN gaps from the completeness sweep closed (+98 principles across 01/02/03/04/08) and the sweep's contradictions resolved — see the "Patched 2026-07-22" section at the end of `00-completeness-sweep.md`.

| File | Domain | Principles |
|---|---|---|
| 01-interaction-and-input.md | Controls, forms, validation, pickers, time/duration/recurrence entry, i18n names-addresses-units, per-widget keyboard/focus contracts, touch, drag, destructive actions, editor undo/canvas, repeat accelerators | 182 |
| 02-navigation-ia-flows.md | IA, navigation, back behavior, URL state, search, onboarding, auth, subscription/checkout, permissions, notifications, overlay-container selection, scheduling views, transactional email, notification inbox, guest migration | 189 |
| 03-feedback-states-status.md | Response times, loading, optimistic UI, toasts, errors, empty states, offline, sync, drafts, confirmations economy, running timers/stopwatches/live sessions | 137 |
| 04-visual-motion-content.md | Typography, spacing, color, hierarchy, radii/elevation, icons, data viz, motion numbers, dark mode, UX writing, i18n/RTL | 168 |
| 05-accessibility-inclusive.md | Full WCAG 2.2 AA in plain English, screen reader, keyboard-only, low vision, motor, cognitive, testing limits | 146 |
| 06-performance-mobile-trust.md | Core Web Vitals, perceived speed, hydration, fonts/images, safe areas, keyboards, mobile quirks, privacy, security UX, anti-dark-patterns, resilience | 175 |
| 07-conversational-ai.md | Chat conventions, streaming, dictation, human-AI interaction (HAX/PAIR), trust, persona boundaries | 123 |
| 08-engagement-data-media-help.md | Streaks/celebrations/goals ethics, tables/lists/dashboards, photo/media, help and support, sharing/invites, UGC safety/moderation/reviews, downloads/export delivery | 191 |
| 00-completeness-sweep.md | Adversarial coverage audit of the set against independent maps of the field (Tidwell, About Face, NN/g taxonomy, HIG/Material, Baymard) | - |

Each file ends with a **Cross-references** list (topics owned by a sibling file) and a **Contested/no-consensus** list (where authorities split - these need house decisions, recorded in the decision log, rather than silent picks by sessions).
