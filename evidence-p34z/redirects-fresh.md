# GATE-03 item 1: alias redirects (fresh run 2026-07-13)

Against http://localhost:3600, unauthenticated, maxRedirects=0. Redirects run before the auth proxy so they respond identically signed-out.

**15/15 PASS**

| Source | Status | Location | Expected | Result |
|---|---|---|---|---|
| /chat | 307 | / | 307 -> / | PASS |
| /coach | 307 | / | 307 -> / | PASS |
| /water | 307 | /hydration | 307 -> /hydration | PASS |
| /weight | 307 | /progress | 307 -> /progress | PASS |
| /body | 307 | /progress | 307 -> /progress | PASS |
| /food | 307 | /nutrition | 307 -> /nutrition | PASS |
| /meals | 307 | /nutrition | 307 -> /nutrition | PASS |
| /calories | 307 | /nutrition | 307 -> /nutrition | PASS |
| /workout | 307 | /workouts | 307 -> /workouts | PASS |
| /settings | 307 | /account | 307 -> /account | PASS |
| /billing | 307 | /account | 307 -> /account | PASS |
| /report | 307 | /reports | 307 -> /reports | PASS |
| /quit | 307 | /quit-date | 307 -> /quit-date | PASS |
| /quit-test | 307 | /quit-date | 307 -> /quit-date | PASS |
| /dashboard | 307 | /today | 307 -> /today | PASS |
