# FIX-03 Benchmark Teardown: Return State & Deep Links in Best-in-Class Dashboards

*Evidence file for FIX-03 (return state and deep links). Goal: document, with real URL examples, how the best current implementations preserve dashboard state in URLs and handle browser back/forward, then distill a testable convention checklist for our Next.js fitness dashboard.*

Researched 2026-07-13 via public documentation, changelogs, and engineering write-ups (Linear and Stripe cannot be logged into; findings rest on docs and publicly observable URL conventions). Research delegated to an Opus agent per the P3/P4 briefing's delegation law; graded and adopted by the P34-B session.

---

## Sources

**Linear**
- Filters - Linear Docs: https://linear.app/docs/filters
- Custom Views - Linear Docs: https://linear.app/docs/custom-views
- Front integration and universal links - Linear Changelog: https://linear.app/changelog/2021-11-18-front-integration-and-universal-links
- GraphQL filtering (developer docs): https://developers.linear.app/docs/graphql/working-with-the-graphql-api/filtering

**Stripe**
- Web Dashboard basics: https://docs.stripe.com/dashboard/basics
- Search transactions (Dashboard): https://docs.stripe.com/dashboard/search
- Deep links in the customer portal: https://docs.stripe.com/customer-management/portal-deep-links
- List Charges / API `created` range filter: https://docs.stripe.com/api/charges/list
- Changelog: creation-date filtering added to more list endpoints: https://docs.stripe.com/changelog/clover/2025-11-17/invoice-payments-list-created

**Ecosystem conventions**
- nuqs Options (history/shallow/scroll/throttle/clearOnDefault): https://nuqs.dev/docs/options
- nuqs (repo / overview): https://github.com/47ng/nuqs
- TanStack Router - Search Params guide: https://tanstack.com/router/latest/docs/guide/search-params
- TanStack Router - Validate Search Params with Schemas: https://tanstack.com/router/latest/docs/how-to/validate-search-params
- TanStack Blog - "Search Params Are State": https://tanstack.com/blog/search-params-are-state
- Next.js - Linking and Navigating (shallow routing via History API): https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating
- Shallow routing on next/navigation (Vercel discussion #48110): https://github.com/vercel/next.js/discussions/48110
- Scroll restoration on browser back with App Router (Next.js issues #20951, #58899): https://github.com/vercel/next.js/issues/20951 - https://github.com/vercel/next.js/issues/58899

---

## 1. Linear - issue-list filters, views, and deep links

**What lives in the URL.** When you apply filters to an issue list, Linear reflects them in the browser URL, and copying the address bar produces a shareable deep link: opening it reapplies the same filters. This is the primary, documented sharing mechanism (Linear Docs, Filters).

**Durable vs ephemeral state - the key split.** Linear deliberately puts only the *main* filters in the URL (assignee, status, label, project, cycle, priority, etc.). It **excludes** view options (grouping, ordering, display density), quick filters, and Insights filters. That is a design decision: the URL carries the *durable, meaningful query* (what set of issues am I looking at) and drops the *ephemeral view chrome* (how they happen to be arranged right now). Result: shared links are stable and portable, not polluted by transient display toggles.

**Custom Views as named durable state.** Rather than relying only on ad-hoc URL strings, Linear promotes recurring queries to Custom Views, each with its own stable URL. You share one via the view's three-dot menu -> *Copy view URL*, or from the address bar. A custom view URL restores the saved filters and display settings for everyone. (Access control is separate: the link doesn't grant access; the view must be shared.) This is the "durable" tier above ad-hoc filter URLs.

**Ad-hoc multi-object deep links.** For a one-off set of issues, Linear supports a comma-separated identifier list in the path:

```
linear.app/{workspace}/issues/ENG-123,ENG-456,ENG-789
```

This opens exactly those issues together without creating a view or a label - a lightweight, human-readable deep link (identifiers, not opaque UUIDs).

**Universal links.** Linear issue URLs act as universal links: the same `linear.app/...` URL opens the native app when installed and falls back to web otherwise (Linear Changelog, 2021). One canonical URL, multiple surfaces.

**Back/forward and history hygiene.** Linear's known behavior is that filter mutation does not spam the history stack with one entry per keystroke; the shareable state is what you land on, and navigating away and back restores the filtered list. Linear is famous for a local-first sync engine (state is held client-side and reconciled), so URL changes reflect committed query state rather than every intermediate interaction. (Linear has not published a URL-router-internals article; this is inferred from documented behavior plus the "only main filters" rule.)

**Takeaway for us:** two tiers - (a) ad-hoc filter state in the URL for shareability, carrying only the meaningful query and omitting view chrome; (b) named saved views with stable URLs for durable, repeat access. Identifiers in deep links are human-readable, not epochs or UUID soup.

---

## 2. Stripe Dashboard - deep links and filter persistence

**Path-based object deep links.** The Dashboard is organized as REST-like, path-addressable resources. The list pages and detail pages have stable, guessable paths (publicly observable conventions; the object-ID prefixes are documented API conventions):

```
https://dashboard.stripe.com/payments               # payments list
https://dashboard.stripe.com/payments/py_1AbC...    # one payment (PaymentIntent/charge detail)
https://dashboard.stripe.com/customers              # customers list
https://dashboard.stripe.com/customers/cus_Xyz...   # one customer detail
https://dashboard.stripe.com/subscriptions/sub_...  # one subscription
```

The `payments` list path is confirmed in Stripe's Web Dashboard docs; the object-detail pattern (`/{resource}/{obj_id}`) follows Stripe's documented ID prefixes (`py_`, `cus_`, `sub_`, `in_`). Because IDs are meaningful, stable primary keys, a detail URL is a durable deep link you can paste into Slack, a runbook, or an email and it resolves to exactly that object.

**Test vs live mode is in the URL, not just a toggle.** Test mode inserts a `/test/` segment into the path:

```
https://dashboard.stripe.com/test/payments
https://dashboard.stripe.com/test/customers/cus_...
```

Mode is thus a first-class, shareable part of the address - a colleague opening your link lands in the same mode you were in. (Account/livemode context is path state; it is not a silently-remembered preference.)

**Filter and date-range serialization (bracket operators).** Stripe's list filtering mirrors its API's `created` range operators, which are documented and use bracketed comparison keys over Unix epoch seconds:

```
?created[gte]=1609459200&created[lt]=1612137600     # created in January 2021
?created[gte]=1710000000&created[lte]=1710086400    # a single day window
```

`gt`/`gte`/`lt`/`lte` are the canonical operators (List Charges API; extended to more list endpoints per the 2025-11-17 changelog). This is the one place Stripe uses raw epochs rather than human-readable tokens - acceptable for an API, but a readability cost worth noting for a UI-facing URL (see checklist item 8).

**What persists in the URL vs account-level preference.** Stripe's split is analogous to Linear's:
- **In the URL / shareable:** which resource, which object (by ID), test/live mode, and applied query filters (status, date range, amount, etc.) on list pages.
- **Account-level preference, NOT in the URL:** column layout, default currency display, saved segments, and per-user view defaults live with the account/user, so they don't travel with a pasted link and don't make links brittle.

**Flows use server-minted session URLs, not client query state.** For the *customer portal* (customer-facing, security-sensitive), Stripe does not encode target state in shareable query params. You POST to `billing_portal/sessions` with `flow_data[type]=subscription_update` (etc.) and receive a one-time `url`. The lesson: *navigational/filter* state belongs in shareable URLs; *authenticated, sensitive, single-use* deep links are minted server-side and are not guessable. Don't put security-bearing intent in a copy-pasteable query string.

**List -> detail -> back.** Stripe's Dashboard keeps the list's filter/search context when you drill into a payment and return, because the filter state is in the list URL - back navigation returns to that exact URL and rehydrates the filtered list. This is the behavior we must match (list scroll + filters preserved on back).

**Takeaway for us:** stable, ID-addressable path deep links per object; mode/context as path state; list filters serialized in the query; user cosmetic prefs kept off the URL; sensitive/one-time links minted server-side.

---

## 3. Ecosystem conventions - how leaders build URL state (nuqs, TanStack Router, Next.js)

### Replace vs push - the central rule

The near-universal convention: **a filter/search change should *replace* the current history entry, not push a new one; only a discrete navigation-like change should push.**

- **nuqs** defaults to `history: 'replace'`, which squashes rapid filter edits into a single history entry. It explicitly warns to use `history: 'push'` *only* for navigation-like UX (tabs, opening a modal/panel), because "breaking the Back button can lead to a bad user experience." (nuqs Options.)
- **Next.js App Router** exposes the same duality through the native History API: `window.history.replaceState` for in-place filter updates (no new back entry, no server round-trip), `window.history.pushState` when you want Back to undo the change. Both integrate with `usePathname`/`useSearchParams` so components stay in sync. (Next.js linking-and-navigating; Vercel discussion #48110.)
- **TanStack Router** models search params as first-class state and updates them with reducer-style partial mutations `(prev) => ({ ...prev, page: 2 })`, replacing by default.

Concretely: typing in a search box or dragging a date range = `replaceState` (one history entry for the whole burst). Switching a tab/segment (e.g. Overview -> Nutrition), or opening a detail = `pushState` (Back returns to the prior view). This prevents "Back is broken because every keystroke is a history entry."

### Throttle the URL, not the UI

nuqs keeps internal React state instant and **throttles only the URL write** (default 50ms; ~120ms on Safari) so a burst of edits produces one coalesced URL update instead of hammering `history`. For high-frequency text inputs the guidance is to debounce the URL write until the user pauses. Principle: the input stays responsive; the address bar and history update once the burst settles.

### Default-value omission

Params sitting at their default are dropped from the URL. nuqs `clearOnDefault` defaults to `true` (v2+): when a value equals its default it's removed from the query string, keeping URLs short and canonical, and - critically - avoiding stale semantics if a default changes later. TanStack does the equivalent via schema `.default(...)`. So `?status=all&sort=date` collapses to a bare URL when `all`/`date` are the defaults. (nuqs Options; TanStack validate-search-params.)

### Serialization: readable tokens and typed schemas, not raw strings

- **TanStack Router** does JSON-first serialization - arrays, objects, numbers, booleans round-trip through the query string with type coercion, validated by a route-level schema (Zod/Valibot/custom via `validateSearch`).
- **Convention for ranges/enums:** prefer human-readable tokens - `range=30d`, `range=12w`, or explicit ISO `from=2026-06-01&to=2026-06-30` - over opaque epochs. (Stripe's API epochs are the exception, justified for machine APIs, not UI URLs.)
- **Arrays:** repeated keys or a delimited list (`label=arms,legs`) rather than indexed brackets, for readability.

### Invalid/unknown params must fail safe

Robustness is a first-class requirement, not an afterthought:
- **TanStack:** `z.number().default(1).catch(1)` - `.default()` supplies a value when the param is absent, `.catch()` supplies a fallback when the param is present but *invalid*, so a garbage param can never crash the route. `search.strict` strips unknown params not declared by any active route.
- **nuqs** parsers return the default when parsing fails.

Net: an unknown or malformed param falls back to default and the page renders; it never throws.

### Shallow routing = no server round-trip

Both nuqs (`shallow: true` default) and Next.js's History-API integration update the URL **client-side only** by default - no RSC re-fetch, no loader re-run - which is what makes per-keystroke filter sync cheap. Opt into `shallow: false` (nuqs) or a real `router.push`/`replace` only when the new params must re-run server data fetching. (nuqs Options; Next.js docs.)

### Scroll restoration - the known caveat

Browsers natively restore scroll on `popstate` (back/forward), and Next.js App Router layers its own restoration (via `focusAndScrollRef`; Pages Router used sessionStorage). **Documented caveats to test against:**
- There is a clean opt-out of scroll-to-top for `Link`/`router.push` via `{ scroll: false }`, but historically **no clean opt-out for browser back/forward** scroll behavior (Next.js issue #20951).
- **Race condition on long lists:** if the restored page's height/expanded content hasn't rehydrated by the time the browser applies the saved scroll offset, the browser clamps the position and you land near the top or at a "load more" boundary instead of the original row (Next.js issues #58899, #20951). Any infinite/virtualized list must restore its item count/height *before* the scroll offset is applied, or Back lands in the wrong place.

---

## 4. Ranking - which reference is the gold standard, and why

**1. Stripe Dashboard - gold standard for dashboard URL state.** Stripe treats every object as a stable, path-addressable, ID-keyed resource (`/payments/py_...`, `/customers/cus_...`), makes mode part of the path (`/test/...`), serializes list filters in the query, keeps cosmetic prefs off the URL, and mints sensitive/one-time deep links server-side. It also nails the list->detail->back behavior that FIX-03 is specifically about. It is the most complete model because it spans *both* durable object deep links *and* transient list filters *and* the security boundary (what is safe to put in a shareable URL vs a minted session). For a data-dashboard product like ours, it is the closest analog.

**2. Linear - gold standard for the filter/view *tier split*.** Its clearest lesson is the deliberate durable-vs-ephemeral partition: only meaningful filters go in the URL; view chrome and quick filters stay out; recurring queries graduate to named Custom Views with their own stable URLs; and ad-hoc multi-object links use human-readable identifiers. Slightly narrower than Stripe (it's one product surface, issues), but its filter-state discipline is the model to copy for our list/dashboard views.

**3. The nuqs / TanStack Router / Next.js ecosystem - gold standard for *mechanics*.** These don't set product conventions; they encode the *how*: replace-within-a-burst / push-on-navigation, throttle the URL not the UI, omit defaults, typed+validated schemas with fail-safe fallbacks, shallow client-only updates, and the scroll-restoration caveats to defend against. This is the implementation layer that makes Stripe/Linear-grade behavior achievable in our Next.js App Router stack.

Summary: **copy Stripe's URL architecture, copy Linear's filter-tier discipline, implement both with the ecosystem's replace/push + validation + shallow-routing mechanics.**

---

## 5. Convention checklist (testable)

A dashboard's URL/return-state behavior conforms if all of these hold. Each is written as a pass/fail check.

1. **Every meaningful view is a shareable URL.** Pasting the current dashboard/list URL into a new tab (or another user's browser) reproduces the same filtered view. Object detail pages are addressable by stable ID (`/exercise/{id}`, `/log/{id}`), never by ephemeral index.
2. **Filter params are omitted at their defaults.** When a filter equals its default (`status=all`, `sort=recent`), the param is absent from the URL. Changing then reverting a filter returns the URL to the clean/canonical form - no `?status=all` residue.
3. **Filter/search changes use `replaceState` within a burst; discrete view changes `push`.** Typing in search, dragging a date range, or toggling a chip replaces the history entry (the whole burst = at most one new entry). Switching a top-level tab/section or opening a detail pushes a new entry so Back is meaningful. Test: type a 6-char search query, press Back once -> returns to the pre-search list, not through 6 intermediate states.
4. **The URL write is throttled/debounced; the UI is instant.** Rapid input updates the on-screen state immediately but coalesces URL writes (throttle ~50ms, or debounce text inputs until pause). Test: fast typing does not produce one history entry or one network round-trip per character.
5. **List -> detail -> Back restores the list's filters AND scroll position.** From a filtered, scrolled list, open an item, press Back -> same filters applied and scrolled to the same row. Explicitly test long/virtualized lists: the item count/height must rehydrate before scroll is applied, or Back lands near the top (documented Next.js race condition).
6. **Cosmetic/per-user prefs stay OUT of the URL.** Column layout, density, theme, and default-currency-style prefs are account/local prefs, not query params, so shared links aren't polluted or made brittle by another user's cosmetics.
7. **Durable, repeat queries can graduate to named saved views with their own stable URLs** (Linear Custom Views model), distinct from ad-hoc filter URLs.
8. **Date ranges and enums use human-readable tokens, not epochs.** Prefer `range=30d` / `range=12w` or ISO `from=2026-06-01&to=2026-06-30` over Unix-epoch brackets in UI-facing URLs. (Epoch `created[gte]=...` is acceptable only for machine APIs.)
9. **Arrays serialize readably.** Multi-select filters use repeated keys or a delimited list (`muscle=arms,legs`), not opaque indexed brackets or JSON blobs in the query.
10. **Unknown or invalid params fail safe, never crash.** A malformed value falls back to its default (TanStack `.default().catch()` pattern; nuqs parser fallback). An unrecognized param is ignored/stripped. Test: hand-edit the URL to `?range=banana&sort=%%%` -> page renders at defaults, no error boundary.
11. **Params are validated against a typed schema before use.** Filter/search params are parsed and type-coerced through one schema (Zod/Valibot or a shared parser), not read as raw strings scattered across components - a single source of truth for reading and constructing URLs.
12. **Filter updates are shallow (client-only) unless server data must change.** Sync filters to the URL without a server round-trip by default; only trigger a real navigation/refetch when the params change what the server must return. Test: applying an in-memory filter does not refetch from the server.
13. **Mode/scope context is in the path, not a hidden toggle** (Stripe `/test/...` model). If our dashboard has a mode or account scope that changes what a URL means, it belongs in the path so a shared link is unambiguous.
14. **Sensitive or single-use deep links are minted server-side, not encoded in guessable query params.** Anything that grants an action or exposes protected data (Stripe's `billing_portal` session pattern) uses a server-generated, non-guessable, expiring URL - never a copy-pasteable query string.
15. **One canonical URL per state.** The same view always serializes to the same URL (stable param order, defaults omitted, no duplicate encodings), so links are deduplicable, cacheable, and comparable.

---

**Key finding for FIX-03 specifically:** the two behaviors most likely to be broken in a Next.js App Router dashboard are checklist items **3** (per-keystroke history pollution - fix with `replaceState` + throttle) and **5** (list scroll/filter loss on Back, aggravated by the documented App Router scroll-restoration race on long lists - fix by restoring list length/height before applying the saved scroll offset). Both are directly testable in a browser and should anchor the acceptance criteria.

**DEC-02 note (this repo):** Progress categories are REAL ROUTES (`/progress/body`, `/progress/training`, decided 2026-07-13). That is checklist item 13 applied: category is path state, never a query param. The FIX-03 URL grammar therefore reserves query params for view state WITHIN a category page (day, range, filters), composing as e.g. `/progress/body?range=3m`. P5 builds the category pages; the conventions here already carry them.
