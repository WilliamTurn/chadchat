/**
 * SURFACE SMOKE GATE (extended 2026-07-16 to every member screen + in-flow
 * states).
 *
 * Renders the real member surfaces (not the dev fixtures) at every supported
 * viewport width and verifies the things a member notices immediately:
 *
 *   1. The surface actually renders (no redirect loop, no error screen,
 *      the page's <main> landmark is visible).
 *   2. Nothing overflows horizontally (no sideways scroll on any phone —
 *      the owner's own device is a 384px-wide Samsung; layouts must be
 *      fluid across ALL of these widths, never tuned to one number).
 *   3. Every action control (button/link) sits FULLY inside the viewport
 *      horizontally — the RUN-68 class, where the Finish button shipped
 *      half-clipped by the right screen edge. Controls inside a deliberate
 *      horizontal scroller (filter chips) are exempt: they are reachable.
 *   4. No console errors or uncaught page errors while it renders.
 *   5. No SERIOUS or CRITICAL axe violation (WCAG 2.2 AA tag set). Added by
 *      S0b-2. Canon 05 is the owner of accessibility; axe is only the
 *      mechanical floor of it — automated rules catch roughly 30-40% of real
 *      accessibility defects, so a clean axe run is a NECESSARY, never a
 *      SUFFICIENT, condition. The ux-* auditors and a keyboard pass own the
 *      remaining 60-70% (focus order, label sense, alt-text quality, reading
 *      order, motion, cognitive load).
 *   6. No horizontal overflow INSIDE any open overlay (D1 A1.1, composition
 *      canon 04 §22 — the finish-dialog screenshot class the page-level
 *      check can't see). Deliberate in-overlay scrollers need an explicit
 *      data-allow-hscroll attribute.
 *   7. No leaf text clipped without ellipsis at 320–384px (D1 A1.2,
 *      composition canon 04 §15/§46; behind the known-failures ratchet).
 *   8. Overlay action bars fully inside the viewport before any scrolling
 *      (D1 A1.3, composition canon 04 §23/§24 — buried confirm buttons).
 *
 * Coverage is two sweeps:
 *   - STATIC: every reachable member URL, grouped to stay inside the test
 *     timeout (first-compile on a dev server is slow).
 *   - STATEFUL: the in-flow states the flaws register's worst bugs lived on,
 *     driven for real at every width — live workout ENGAGED with a logged
 *     set, the finish dialog OPEN, the exercise picker mid-flow, workout
 *     complete, and the hydration + sleep logging overlays open.
 *
 * Runs with `pnpm test` (or `pnpm test:smoke` alone). Each worker registers
 * a fresh user through the real /register UI, then grants it an active Pro
 * plan + onboarded flag directly in the database (the same fields the
 * Stripe webhook would set) so the paywall and welcome wizard don't block
 * the dashboards. Requires POSTGRES_URL (loaded from .env.local by
 * playwright.config.ts).
 *
 * NOT covered here (needs data or state this gate can't create cheaply):
 * /goals/[id] and /plans/[id] (need a created goal/plan), /chat/[id],
 * /share/[id], /q/[id], /checkout/success, /welcome (redirects once
 * onboarded), /reports as an ELITE member (a Pro member sees the teaser,
 * which IS swept).
 */

import AxeBuilder from "@axe-core/playwright";
import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import postgres from "postgres";
import axeKnownFailures from "./axe-known-failures.json";
import knownFailures from "./smoke-known-failures.json";

/**
 * Pre-existing defects pinned when the gate was extended (2026-07-16): a
 * pinned screen+check downgrades to a logged warning instead of a failure,
 * so the gate can land while the defect is owed to a fix wave. Entries are
 * only ever REMOVED (the ratchet); the test logs loudly once a pinned entry
 * starts passing so it gets unpinned in the same change that fixed it.
 *
 * D1 (2026-07-23) added three composition checks (canon numbers cite
 * ../chadlatest/audits/design-standards-2026-07-23/composition-canon/):
 * "overlay-overflow", "clipped-text", "dialog-actions".
 */
type KnownFailureCheck =
  | "overflow"
  | "clipped"
  | "console"
  | "overlay-overflow"
  | "clipped-text"
  | "dialog-actions";
function isKnownFailure(
  surface: string,
  check: KnownFailureCheck,
  width: number
): string | null {
  for (const entry of knownFailures.entries) {
    if (
      entry.surface === surface &&
      entry.check === check &&
      entry.widths.includes(width)
    ) {
      return entry.reason;
    }
  }
  return null;
}

/**
 * The axe half of the ratchet (S0b-2). Same remove-only contract as the pins
 * above, but keyed per accessibility RULE as well as screen and width: a
 * screen that pins `color-contrast` still fails on a new `label` violation,
 * so a pin can never grandfather a defect it was not written for.
 */
function isKnownAxeFailure(
  surface: string,
  ruleId: string,
  width: number
): string | null {
  for (const entry of axeKnownFailures.entries) {
    if (
      entry.surface === surface &&
      entry.rule === ruleId &&
      entry.widths.includes(width)
    ) {
      return entry.reason;
    }
  }
  return null;
}

/**
 * WCAG 2.2 AA is the legal floor (EAA since June 2025, ADA Title II from
 * 2026), so the tag set is the full A + AA ladder rather than axe's default.
 * `best-practice` rules are deliberately excluded: they are opinions, and the
 * canon — not axe — is this app's opinion.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Only these two impact levels gate. Minor/moderate findings are surfaced by
 *  the auditors, which can judge whether they matter to a member. */
const AXE_BLOCKING_IMPACTS = new Set(["serious", "critical"]);

type AxeFinding = { rule: string; impact: string; nodes: number; help: string };

async function axeFindings(page: Page): Promise<AxeFinding[]> {
  const results = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    // The Next.js dev-tools badge is not product markup and does not exist in
    // prod; scanning it would pin defects the member can never meet.
    .exclude("nextjs-portal")
    .analyze();
  return results.violations
    .filter((v) => AXE_BLOCKING_IMPACTS.has(v.impact ?? ""))
    .map((v) => ({
      rule: v.id,
      impact: v.impact ?? "unknown",
      nodes: v.nodes.length,
      help: v.help,
    }));
}

/** Every reachable member screen, grouped so one test stays inside the
 *  240s budget even when the dev server first-compiles each route. */
const SURFACE_GROUPS: Record<string, string[]> = {
  "core-dashboards": [
    "/home",
    "/nutrition",
    "/hydration",
    "/sleep",
    "/workouts",
    "/progress",
  ],
  "training-screens": [
    "/progress/body",
    "/progress/training",
    "/workouts/history",
    "/workouts/exercises",
    "/workouts/exercises/pick",
    "/workouts/exercises/new",
    "/workouts/new",
    "/workouts/cardio",
  ],
  "plans-goals-reports": [
    "/goals",
    "/goals/new",
    "/reports",
    "/plans",
    "/meal-plan",
    "/future-you",
    "/quit-date",
  ],
  "account-misc": [
    "/kitchen",
    "/account",
    "/account/appearance",
    "/help",
    "/files",
    "/pricing",
    "/",
  ],
};

// Fluid-layout coverage: smallest supported phone up to desktop. 384 is the
// owner's actual Samsung viewport; it is deliberately NOT the only width.
const VIEWPORTS = [
  { name: "phone-320", width: 320, height: 568 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-384", width: 384, height: 832 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

// Console noise that is not a product defect.
const CONSOLE_IGNORE = [/Download the React DevTools/i, /\[Fast Refresh\]/i];

let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }, workerInfo) => {
  // Unique per worker AND per run: second-precision timestamps collide when
  // parallel workers start together.
  const email = `smoke-${Date.now()}-w${workerInfo.workerIndex}@playwright.com`;
  // The register form enforces the full requirements checklist.
  const strongPassword = `Aa1-${Math.random().toString(36).slice(2, 12)}`;

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(strongPassword);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill(strongPassword);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign up" }).click();
  // Success signs the user in and refreshes; wherever it lands, the session
  // cookie is what we need.
  // Generous: registration on this dev box takes ~40s when routes are cold.
  await page.waitForURL((url) => !url.pathname.startsWith("/register"), {
    timeout: 120_000,
  });

  // Grant access the way a completed checkout would (subscription fields) and
  // skip the welcome wizard (onboardedAt), so every dashboard is reachable.
  const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
  try {
    const updated = await sql`
      UPDATE "User"
      SET "subscriptionStatus" = 'active',
          "subscriptionTier"   = 'pro',
          "currentPeriodEnd"   = now() + interval '30 days',
          "onboardedAt"        = now()
      WHERE email = ${email}
      RETURNING id
    `;
    if (updated.length !== 1) {
      throw new Error(
        `smoke setup: expected to provision exactly 1 user for ${email}, got ${updated.length}`
      );
    }
  } finally {
    await sql.end();
  }

  storageState = await context.storageState();
  await context.close();
});

type ConsoleLog = string[];

function collectConsoleErrors(page: Page): ConsoleLog {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      !CONSOLE_IGNORE.some((re) => re.test(msg.text()))
    ) {
      errors.push(`[${page.url()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    errors.push(`[${page.url()}] uncaught: ${err.message}`);
  });
  return errors;
}

async function openMemberContext(
  browser: Browser,
  viewport: { width: number; height: number }
) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const consoleErrors = collectConsoleErrors(page);
  return { context, page, consoleErrors };
}

/** Horizontal-overflow measure: content must fit the viewport width. */
async function overflowPx(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const widest = Math.max(
      doc.scrollWidth,
      document.body ? document.body.scrollWidth : 0
    );
    return widest - doc.clientWidth;
  });
}

type ClippedControl = {
  name: string;
  left: number;
  right: number;
  viewport: number;
};

/**
 * The RUN-68 class, asserted mechanically: every visible action control must
 * sit fully inside the viewport horizontally. A control inside an ancestor
 * that intentionally scrolls horizontally (filter chips, carousels) is
 * reachable by scrolling and therefore exempt. Vertical position is not
 * asserted: pages scroll vertically by design.
 */
async function clippedControls(page: Page): Promise<ClippedControl[]> {
  return await page.evaluate(() => {
    const isScrollableX = (el: Element) => {
      const s = getComputedStyle(el);
      return (
        (s.overflowX === "auto" || s.overflowX === "scroll") &&
        el.scrollWidth > el.clientWidth + 1
      );
    };
    const out: {
      name: string;
      left: number;
      right: number;
      viewport: number;
    }[] = [];
    const vw = document.documentElement.clientWidth;
    const controls = document.querySelectorAll(
      'button, [role="button"], a[href], input[type="submit"]'
    );
    for (const el of controls) {
      // The sidebar rail is a deliberate invisible hit-strip (tabIndex -1)
      // that spans 100vw from the sidebar edge; its usable area is fully
      // in-viewport, so the overshoot hides nothing from the member.
      if (el.closest('[data-slot="sidebar-rail"]')) {
        continue;
      }
      const r = el.getBoundingClientRect();
      // Skip collapsed/hidden controls and sr-only (1px) elements.
      if (r.width <= 1.5 || r.height <= 1.5) {
        continue;
      }
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") {
        continue;
      }
      let parent = el.parentElement;
      let exempt = false;
      while (parent) {
        if (isScrollableX(parent)) {
          exempt = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (exempt) {
        continue;
      }
      if (r.left < -0.5 || r.right > vw + 0.5) {
        out.push({
          name:
            (el.getAttribute("aria-label") || el.textContent || "(unnamed)")
              .trim()
              .slice(0, 60) || "(unnamed)",
          left: Math.round(r.left),
          right: Math.round(r.right),
          viewport: vw,
        });
      }
    }
    return out;
  });
}

type OverlayOverflow = {
  overlay: string;
  element: string;
  scrollWidth: number;
  clientWidth: number;
};

/**
 * D1 A1.1 — horizontal scroll INSIDE an open overlay is always a defect,
 * zero exceptions at any width (composition canon 04 §22; the finish-dialog
 * screenshot class: a scrollbar inside the dialog with a clipped unit label).
 * The page-level overflow check cannot see it, so every element inside every
 * open overlay is measured: scrollWidth must fit clientWidth. A deliberate
 * horizontal scroller inside an overlay must carry an explicit
 * `data-allow-hscroll` attribute (same idea as the clipped-control
 * exemption, but explicit because canon 04 §22 says the default is "never").
 */
async function overlayOverflows(page: Page): Promise<OverlayOverflow[]> {
  return await page.evaluate(() => {
    const out: {
      overlay: string;
      element: string;
      scrollWidth: number;
      clientWidth: number;
    }[] = [];
    const describe = (el: Element) => {
      const cls = (el.getAttribute("class") || "").split(/\s+/).slice(0, 4);
      const text = (el.textContent || "").trim().slice(0, 40);
      return `<${el.tagName.toLowerCase()}${cls.length ? ` class="${cls.join(" ")}…"` : ""}> "${text}"`;
    };
    const overlays = document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"]'
    );
    for (const overlay of overlays) {
      const or = overlay.getBoundingClientRect();
      if (or.width <= 1.5 || or.height <= 1.5) {
        continue; // closed or collapsed
      }
      for (const el of [overlay, ...overlay.querySelectorAll("*")]) {
        if (el.namespaceURI !== "http://www.w3.org/1999/xhtml") {
          continue; // svg internals measure their own way
        }
        if (el.closest("[data-allow-hscroll]")) {
          continue;
        }
        if (el.clientWidth <= 0) {
          continue; // inline boxes have no client area to overflow
        }
        const rect = el.getBoundingClientRect();
        if (rect.width <= 1.5 || rect.height <= 1.5) {
          continue; // sr-only (1px) boxes clip their content by design
        }
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") {
          continue;
        }
        if (el.scrollWidth > el.clientWidth + 1) {
          out.push({
            overlay: describe(overlay),
            element: describe(el),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          });
        }
      }
    }
    return out;
  });
}

type ClippedText = {
  text: string;
  element: string;
  scrollWidth: number;
  clientWidth: number;
};

/**
 * D1 A1.2 — leaf text that overflows its own box without an ellipsis at
 * phone widths (composition canon 04 §15: never make content fit by
 * clipping it; 04 §46 / forms canon 03 #18/#23: unit labels and row text
 * must be budgeted into the row, the screenshot's clipped "s" class).
 * Ellipsis truncation is design-lint's silent-truncation rule; form
 * controls scroll their value by design; code blocks may scroll (canon 04
 * §19); text inside a deliberate horizontal scroller is reachable. Noisy by
 * nature, so it ships behind the known-failures ratchet at 320–384px only.
 */
async function clippedTextLabels(page: Page): Promise<ClippedText[]> {
  return await page.evaluate(() => {
    const out: {
      text: string;
      element: string;
      scrollWidth: number;
      clientWidth: number;
    }[] = [];
    const isScrollableX = (el: Element) => {
      const s = getComputedStyle(el);
      return (
        (s.overflowX === "auto" || s.overflowX === "scroll") &&
        el.scrollWidth > el.clientWidth + 1
      );
    };
    const SKIP_TAGS =
      /^(?:INPUT|TEXTAREA|SELECT|OPTION|SCRIPT|STYLE|IFRAME|CANVAS|PRE|CODE)$/;
    for (const el of document.querySelectorAll("body *")) {
      if (el.namespaceURI !== "http://www.w3.org/1999/xhtml") {
        continue;
      }
      if (SKIP_TAGS.test(el.tagName)) {
        continue;
      }
      if (el.closest("[data-allow-hscroll]")) {
        continue;
      }
      let hasText = false;
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && (n.textContent || "").trim().length > 0) {
          hasText = true;
          break;
        }
      }
      if (!hasText || el.clientWidth <= 0) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width <= 1.5 || r.height <= 1.5) {
        continue; // collapsed / sr-only
      }
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") {
        continue;
      }
      if (style.textOverflow === "ellipsis") {
        continue; // design-lint silent-truncation owns ellipsis
      }
      let parent = el.parentElement;
      let exempt = false;
      while (parent) {
        if (isScrollableX(parent)) {
          exempt = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (exempt) {
        continue;
      }
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push({
          text: (el.textContent || "").trim().slice(0, 60),
          element: `<${el.tagName.toLowerCase()}>`,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        });
      }
    }
    return out;
  });
}

type BuriedActions = {
  overlay: string;
  footerTop: number;
  footerBottom: number;
  viewportHeight: number;
};

/**
 * D1 A1.3 — an open overlay's action bar must be inside the viewport before
 * any scrolling (composition canon 04 §23/§24: only the body zone may
 * scroll; actions never scroll out of reach — the screenshot's buried
 * confirm buttons). Every footer slot ends in "-footer"
 * (dialog/alert-dialog/drawer/sheet), so overlays without an action bar
 * (popovers, info dialogs closed by X) are naturally skipped.
 */
async function buriedDialogActions(page: Page): Promise<BuriedActions[]> {
  return await page.evaluate(() => {
    const out: {
      overlay: string;
      footerTop: number;
      footerBottom: number;
      viewportHeight: number;
    }[] = [];
    const vh = window.visualViewport
      ? window.visualViewport.height
      : window.innerHeight;
    const overlays = document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"]'
    );
    for (const overlay of overlays) {
      const or = overlay.getBoundingClientRect();
      if (or.width <= 1.5 || or.height <= 1.5) {
        continue;
      }
      const footer = overlay.querySelector('[data-slot$="-footer"]');
      if (!footer) {
        continue;
      }
      const r = footer.getBoundingClientRect();
      if (r.height <= 0) {
        continue;
      }
      if (r.bottom > vh + 0.5 || r.top < -0.5) {
        out.push({
          overlay: `"${(
            overlay.getAttribute("aria-label") ||
            overlay.querySelector("h1,h2,h3")?.textContent ||
            "(unnamed)"
          )
            .trim()
            .slice(0, 40)}"`,
          footerTop: Math.round(r.top),
          footerBottom: Math.round(r.bottom),
          viewportHeight: Math.round(vh),
        });
      }
    }
    return out;
  });
}

/** The per-screen assertions, shared by both sweeps. `surface` is the
 *  stable key known-failure pins match against (a URL for the static sweep,
 *  a "flow:" key for in-flow states). */
async function assertScreenClean(
  page: Page,
  surface: string,
  viewport: { name: string; width: number }
): Promise<void> {
  const label = `${surface} @ ${viewport.name}`;
  // Let streamed/suspended content settle before measuring.
  await page.waitForLoadState("networkidle").catch(() => {
    // Long-polling keeps some pages from ever going idle; proceed.
  });

  // Poll until the screen settles: pre-hydration loading states park
  // transient plumbing off-viewport (e.g. the sidebar rail's 100vw drag
  // strip), which is not a member-facing defect. Only a PERSISTENT
  // overflow or clipped control fails the gate.
  // clipped-text is asserted at phone widths only (A1.2's remit is 320–384;
  // wider viewports make the leaf-text heuristic mostly noise).
  const checkClippedText = viewport.width <= 384;
  const deadline = Date.now() + 15_000;
  let overflow = 0;
  let clipped: ClippedControl[] = [];
  let overlayOv: OverlayOverflow[] = [];
  let clippedText: ClippedText[] = [];
  let buried: BuriedActions[] = [];
  for (;;) {
    overflow = await overflowPx(page);
    clipped = await clippedControls(page);
    overlayOv = await overlayOverflows(page);
    clippedText = checkClippedText ? await clippedTextLabels(page) : [];
    buried = await buriedDialogActions(page);
    if (
      overflow <= 1 &&
      clipped.length === 0 &&
      overlayOv.length === 0 &&
      clippedText.length === 0 &&
      buried.length === 0
    ) {
      break;
    }
    if (Date.now() > deadline) {
      break;
    }
    await page.waitForTimeout(500);
  }

  const overflowPin = isKnownFailure(surface, "overflow", viewport.width);
  if (overflow > 1 && overflowPin) {
    console.warn(
      `KNOWN FAILURE (pinned): ${label} overflows by ${overflow}px. ${overflowPin}`
    );
  } else {
    if (overflow <= 1 && overflowPin) {
      console.warn(
        `PINNED ENTRY NOW PASSING: ${label} overflow. Remove it from smoke-known-failures.json.`
      );
    }
    expect
      .soft(
        overflow,
        `${label}: content overflows the viewport horizontally by ${overflow}px`
      )
      .toBeLessThanOrEqual(1);
  }

  const clippedPin = isKnownFailure(surface, "clipped", viewport.width);
  if (clipped.length > 0 && clippedPin) {
    console.warn(
      `KNOWN FAILURE (pinned): ${label} has clipped controls. ${clippedPin}`
    );
  } else {
    if (clipped.length === 0 && clippedPin) {
      console.warn(
        `PINNED ENTRY NOW PASSING: ${label} clipped controls. Remove it from smoke-known-failures.json.`
      );
    }
    expect
      .soft(
        clipped,
        `${label}: action controls clipped by the viewport edge (RUN-68 class)`
      )
      .toEqual([]);
  }

  // The D1 composition checks share one pin-aware assertion shape.
  const assertCompositionCheck = (
    check: KnownFailureCheck,
    findings: unknown[],
    message: string
  ) => {
    const pin = isKnownFailure(surface, check, viewport.width);
    if (findings.length > 0 && pin) {
      console.warn(
        `KNOWN FAILURE (pinned): ${label} ${check} x${findings.length}. ${pin}`
      );
      return;
    }
    if (findings.length === 0 && pin) {
      console.warn(
        `PINNED ENTRY NOW PASSING: ${label} ${check}. Remove it from smoke-known-failures.json.`
      );
    }
    expect.soft(findings, `${label}: ${message}`).toEqual([]);
  };

  assertCompositionCheck(
    "overlay-overflow",
    overlayOv,
    "horizontal overflow inside an open overlay (composition canon 04 §22, the finish-dialog screenshot class)"
  );
  if (checkClippedText) {
    assertCompositionCheck(
      "clipped-text",
      clippedText,
      "text clipped without ellipsis at phone width (composition canon 04 §15/§46)"
    );
  }
  assertCompositionCheck(
    "dialog-actions",
    buried,
    "overlay action bar outside the viewport before any scrolling (composition canon 04 §23/§24)"
  );

  await assertAxeClean(page, surface, viewport);
}

/**
 * The axe pass (S0b-2, canon 05). Every blocking finding is echoed as a
 * machine-readable `AXE-FINDING {...}` line whether it is pinned or not, so a
 * whole-suite run can be piped straight into a regenerated pin file; only
 * UNPINNED findings fail the gate.
 */
async function assertAxeClean(
  page: Page,
  surface: string,
  viewport: { name: string; width: number }
): Promise<void> {
  const label = `${surface} @ ${viewport.name}`;
  const findings = await axeFindings(page);
  const found = new Set(findings.map((f) => f.rule));
  const unpinned: AxeFinding[] = [];

  for (const finding of findings) {
    console.warn(
      `AXE-FINDING ${JSON.stringify({
        surface,
        width: viewport.width,
        ...finding,
      })}`
    );
    const pin = isKnownAxeFailure(surface, finding.rule, viewport.width);
    if (pin) {
      console.warn(
        `KNOWN FAILURE (pinned): ${label} axe ${finding.rule} x${finding.nodes}. ${pin}`
      );
    } else {
      unpinned.push(finding);
    }
  }

  // The ratchet's other half: a pin that no longer reproduces must be deleted
  // in the change that fixed it.
  for (const entry of axeKnownFailures.entries) {
    if (
      entry.surface === surface &&
      entry.widths.includes(viewport.width) &&
      !found.has(entry.rule)
    ) {
      console.warn(
        `PINNED ENTRY NOW PASSING: ${label} axe ${entry.rule}. Remove it from axe-known-failures.json.`
      );
    }
  }

  expect
    .soft(
      unpinned,
      `${label}: serious/critical accessibility violations (WCAG 2.2 AA, canon 05)`
    )
    .toEqual([]);
}

/* --------------------------------------------------------------------------
 * STATIC SWEEP: every reachable member URL x every width.
 * ------------------------------------------------------------------------ */

for (const viewport of VIEWPORTS) {
  for (const [groupName, surfaces] of Object.entries(SURFACE_GROUPS)) {
    test(`${groupName} render clean at ${viewport.name} (${viewport.width}px)`, async ({
      browser,
    }) => {
      const { context, page, consoleErrors } = await openMemberContext(
        browser,
        viewport
      );

      for (const surface of surfaces) {
        await page.goto(surface, { waitUntil: "load" });

        // Reachable: still on the surface (not bounced to /login, /pricing,
        // /welcome, or /legal) and the page landmark rendered.
        expect
          .soft(
            new URL(page.url()).pathname,
            `${surface} @ ${viewport.name}: member was redirected away`
          )
          .toBe(surface);
        await expect
          .soft(
            page.locator("main").first(),
            `${surface} @ ${viewport.name}: page <main> never rendered`
          )
          .toBeVisible({ timeout: 30_000 });

        await assertScreenClean(page, surface, viewport);
      }

      // Silent console across the whole sweep.
      expect
        .soft(consoleErrors, `console/page errors at ${viewport.name}`)
        .toEqual([]);

      await context.close();
    });
  }
}

/* --------------------------------------------------------------------------
 * STATEFUL SWEEP: the in-flow states the register's worst bugs lived on.
 * One test per width drives the real flows end to end and asserts at each
 * checkpoint. localStorage (the live session) is context-scoped, so each
 * width starts clean.
 * ------------------------------------------------------------------------ */

for (const viewport of VIEWPORTS) {
  test(`in-flow states render clean at ${viewport.name} (${viewport.width}px)`, async ({
    browser,
  }) => {
    const { context, page, consoleErrors } = await openMemberContext(
      browser,
      viewport
    );

    // --- Live workout: start empty, PENDING session screen.
    await page.goto("/workouts");
    await page
      .getByRole("button", { name: /start an empty workout/i })
      .first()
      .click();
    await page.waitForURL("**/workouts/active**");
    await assertScreenClean(page, "flow:workout-session-pending", viewport);

    // --- Exercise picker, entered MID-FLOW from the session.
    await page.getByRole("button", { name: "Add your first exercise" }).click();
    await page.waitForURL("**/exercises/pick**");
    await assertScreenClean(page, "flow:exercise-picker-mid-flow", viewport);
    await page
      .getByRole("button", { name: /Barbell Bench Press/i })
      .first()
      .click();
    await page.getByRole("button", { name: /Add 1 exercise to/i }).click();
    await page.waitForURL("**/workouts/active**", { timeout: 15_000 });

    // --- ENGAGED session: Play pressed (through the S4 start countdown,
    //     skipped for speed), one set logged.
    await page.getByRole("button", { name: "Start the workout timer" }).click();
    await page.getByRole("button", { name: "Skip countdown" }).click();
    await page
      .getByRole("button", { name: "Pause the workout timer" })
      .waitFor({ state: "visible" });
    await page.getByLabel(/Weight in lb for set 1/).fill("100");
    await page.getByLabel(/Reps for set 1/).fill("5");
    await page.getByRole("button", { name: /Log set 1 .* as done/ }).click();
    await assertScreenClean(page, "flow:workout-session-engaged", viewport);

    // --- Full page loads WITH the live session persisted (CI-8): the mini
    //     bar, resume card, and player render from localStorage state the
    //     server never saw, so these pages must hydrate without errors.
    await page.goto("/workouts", { waitUntil: "load" });
    await assertScreenClean(page, "flow:workouts-reload-mid-session", viewport);
    await page.goto("/workouts/active", { waitUntil: "load" });
    await assertScreenClean(page, "flow:player-reload-mid-session", viewport);

    // --- Finish step (its own page since W1; composition canon 04 §11/§12:
    //     the finish form outgrew the confirm dialog it used to live in).
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await page.waitForURL("**/workouts/active/finish**", { timeout: 15_000 });
    const finishSave = page.getByRole("button", { name: "Finish and save" });
    await expect(finishSave).toBeVisible();
    await assertScreenClean(page, "flow:finish-step", viewport);

    // --- Workout COMPLETE (the ?new=1 celebration view of history/[id]).
    await finishSave.click();
    await page.waitForURL("**/workouts/history/**", { timeout: 30_000 });
    await expect(page.getByText(/workout complete/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await assertScreenClean(page, "flow:workout-complete", viewport);

    // --- Hydration logging overlay OPEN.
    await page.goto("/hydration");
    await page.getByRole("button", { name: "Log water" }).first().click();
    await expect(page.locator('[role="dialog"]').last()).toBeVisible();
    await assertScreenClean(page, "flow:hydration-log-overlay", viewport);
    await page.keyboard.press("Escape");

    // --- Sleep logging overlay OPEN ("Log last night" on a fresh account;
    //     "Edit last night" once logged).
    await page.goto("/sleep");
    await page
      .getByRole("button", { name: /(Log|Edit) last night/ })
      .first()
      .click();
    await expect(page.locator('[role="dialog"]').last()).toBeVisible();
    await assertScreenClean(page, "flow:sleep-log-overlay", viewport);
    await page.keyboard.press("Escape");

    expect
      .soft(
        consoleErrors,
        `console/page errors during in-flow sweep at ${viewport.name}`
      )
      .toEqual([]);

    await context.close();
  });
}

/* --------------------------------------------------------------------------
 * D1 REGRESSION FIXTURE: the composition checks must keep catching the
 * finish-workout screenshot class even after the live dialogs are rebuilt
 * (the buried-actions half no longer reproduces in the driven flow). The
 * fixture (/dev/fixtures/overlays?open=composition-defects) reproduces all
 * three defects on purpose; each check must FIRE there or the gate has
 * silently gone blind.
 * ------------------------------------------------------------------------ */

test("composition checks catch the screenshot defect class (fixture)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 384, height: 700 },
  });
  const page = await context.newPage();
  await page.goto("/dev/fixtures/overlays?open=composition-defects");
  await expect(page.locator('[role="alertdialog"]')).toBeVisible();
  expect(
    (await overlayOverflows(page)).length,
    "overlay-overflow must fire on the fixture's overflowing dialog (canon 04 §22)"
  ).toBeGreaterThan(0);
  expect(
    (await clippedTextLabels(page)).length,
    "clipped-text must fire on the fixture's clipped unit label (canon 04 §15/§46)"
  ).toBeGreaterThan(0);
  expect(
    (await buriedDialogActions(page)).length,
    "dialog-actions must fire on the fixture's buried action bar (canon 04 §23/§24)"
  ).toBeGreaterThan(0);
  await context.close();
});
