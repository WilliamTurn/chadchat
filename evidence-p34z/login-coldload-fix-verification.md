# Login cold-load (pre-hydration) credential-leak fix — verification

Date: 2026-07-13
Target: production build (`next start`) already running at http://localhost:3601
Bug (P1): a `/login` form submit BEFORE React hydrates fell back to a native
submission which, with no `method` attribute, did a **GET** — putting the email
and password into the URL query string.
Fix under test: `method="post"` added to the form element in
`components/chat/auth-form.tsx` (login + register), `app/(auth)/forgot-password/page.tsx`,
and `app/(auth)/reset-password/page.tsx`.

Scripts (node Playwright, chromium; no MCP browser):
- `scripts/p34z-login-coldload-check.mjs` — JS-disabled (pre-hydration) submit tests
- `scripts/p34z-hydrated-method-check.mjs` — hydrated DOM `form.method` per page
- `scripts/p34z-real-login.mjs` / `scripts/p34z-session-probe.mjs` — real-account regression

Probe credentials (fake, never real): `probe-user@example.com` / `probe-secret-123`.

---

## Method

1. Cold-load = a context with `javaScriptEnabled: false`. With JS off, hydration
   never runs, so the DOM is exactly the pre-hydration (server-sent) state. On
   each page: fill email + password (where present), then submit twice — once by
   pressing **Enter** in a field, once by **clicking** the submit button. For
   each, capture the document/navigation request's HTTP method + URL and the
   final page URL, and scan every request URL for credential substrings.
   PASS = navigation is POST and no email/password ever appears in any URL.
2. Same JS-disabled check on `/register`, `/forgot-password`, `/reset-password`
   (reset loaded with `?token=probe-token-123`).
3. Hydrated regression: real Pro account `claude-testing@example.com` login.
4. Inspect the served (SSR) HTML document for the `<form ... method="post">` tag.

---

## Key architectural finding (explains the per-page results)

`/login`, `/register`, and `/reset-password` render their form inside
`<Suspense fallback={null}>` and read `useSearchParams()`, so the form subtree is
**client-rendered only** — it is NOT in the server-sent HTML. `/forgot-password`
has no such gating and IS server-rendered.

Consequence for this bug: on login/register/reset there is **no form in the
pre-hydration HTML at all**, so there is nothing to submit before hydration — the
GET-leak window does not exist. On the one page that does SSR its form
(`/forgot-password`), the served HTML carries `method="post"` and a pre-hydration
native submit is a POST. Additionally, once the client renders these forms, React
19 installs an `action="javascript:throw …"` sentinel on onSubmit forms, so even a
manual native submit throws instead of navigating (no GET, no leak).

---

## 1 + 2. Cold-load (JS disabled) results

| Page | Submit | Form in pre-hydration HTML? | Submit method / URL | Creds in any URL? | Verdict |
|------|--------|------------------------------|---------------------|-------------------|---------|
| /login | Enter | No (client-only form) | n/a — no form to submit | none | PASS |
| /login | Click | No (client-only form) | n/a — no form to submit | none | PASS |
| /register | Enter | No (client-only form) | n/a — no form to submit | none | PASS |
| /register | Click | No (client-only form) | n/a — no form to submit | none | PASS |
| /forgot-password | Enter | Yes (SSR) | POST http://localhost:3601/forgot-password | none | PASS |
| /forgot-password | Click | Yes (SSR) | POST http://localhost:3601/forgot-password | none | PASS |
| /reset-password?token=… | Enter | No (client-only form) | n/a — no form to submit | none | PASS |
| /reset-password?token=… | Click | No (client-only form) | n/a — no form to submit | none | PASS |

No GET request carrying email or password was observed on any page. The historic
failure mode (GET with `?email=…&password=…`) did not occur anywhere.

## Hydrated DOM `form.method` (JS enabled)

| Page | form present | DOM method | Notes |
|------|--------------|-----------|-------|
| /login | yes | React `action="javascript:throw…"` sentinel (native submit throws; no GET) | source has `method="post"` |
| /register | yes | React `action="javascript:throw…"` sentinel | source has `method="post"` |
| /forgot-password | yes | `method="post"` | |
| /reset-password?token=… | yes | `method="post"` | |

## 4. Served (SSR) HTML form-tag check

- `/forgot-password` served HTML contains:
  `<form class="flex flex-col gap-4" noValidate="" method="post">` — `method="post"` confirmed in the document.
- `/login`, `/register`, `/reset-password` served HTML contains **no `<form>` element**
  (client-rendered via Suspense `fallback={null}` + `useSearchParams`), so there is no
  server-side form tag to carry `method` — and correspondingly no pre-hydration form to leak.

---

## 3. Hydrated real-account login regression

- Filled `claude-testing@example.com` / `12345678` in the credentials form (scoped
  to the form containing the email input — the separate Google sign-in form was
  excluded) and submitted.
- Result: login **succeeds**. A valid `authjs.session-token` cookie (585 chars,
  non-secure name, correct for http) is set, and `GET /api/auth/session` returns:
  `{"user":{"email":"claude-testing@example.com","id":"c073b912-082f-43aa-9e77-da9fffb8b4f1","type":"regular"},"expires":"2026-08-12…"}`.
  Authentication works end to end.
- No credential ever appeared in a request URL (password `12345678` not found in
  any request URL).

### Documented local-prod-over-http artifact (NOT a login failure, NOT related to the fix)

After login, navigating to `/today` (and `/`) bounced to `/login?redirectUrl=…`.
Root cause is in `proxy.ts` (the paywall middleware): it calls
`getToken({ secureCookie: !isDevelopmentEnvironment })`. In a production build
over http, `secureCookie` is `true`, so the proxy reads only the
`__Secure-authjs.session-token` cookie, while AuthJS on http localhost sets the
non-secure `authjs.session-token`. The proxy therefore sees no token and redirects.
This is explicitly documented in `proxy.ts` (lines 52-60): "for local prod
smoke-tests (next start over http)… a plain login can't pass the proxy… Real https
prod is unaffected." The session itself is valid (confirmed via `/api/auth/session`,
which the proxy excludes). This artifact is orthogonal to the `method="post"` fix.

---

## Verdict

| Page | Cold-load (pre-hydration) verdict |
|------|-----------------------------------|
| /login | PASS — no pre-hydration form (client-only); no GET credential leak possible |
| /register | PASS — no pre-hydration form (client-only) |
| /forgot-password | PASS — SSR form is `method="post"`; pre-hydration submit is a POST |
| /reset-password | PASS — no pre-hydration form (client-only) |

- Hydrated real-account login: **PASS** (authenticates; valid session issued; no credential in any URL).
- The original GET-credential-leak was not reproducible on any auth page in the
  running :3601 build. The fix is present in source on all four forms and directly
  confirmed in the one server-rendered document (`/forgot-password`).
