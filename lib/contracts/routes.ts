/**
 * ROUTE + TERMINOLOGY REGISTRY (DSH-66 / Phase 1). One owner per destination,
 * one canonical name per concept. Documentation-as-code in Phase 1: nothing
 * here changes navigation behavior yet (grouped nav, redirects, and return
 * state are Phase 3 / FIX-02/03/20/21). It exists so that:
 *
 *   1. Every capability has exactly one registered home. A card that links
 *      somewhere links to a REGISTERED destination with its registered name.
 *   2. Two surfaces can never drift into calling the same place two things.
 *      A unit test asserts this registry and `lib/nav-links.ts` agree.
 *   3. Proposed renames are recorded as PROPOSALS with status, never applied
 *      silently (naming is owner-approval territory).
 *
 * Ground truth: the folders under `app/` and the labels in `lib/nav-links.ts`
 * as of 2026-07-11. If a route is added or renamed, update this registry in
 * the same PR (the drift test fails otherwise).
 *
 * Scope: every member-facing product destination. Auth pages, share/quit
 * public views (/share/[id], /q/[id], /roast), checkout callbacks, and the
 * admin panel are deliberately unregistered utility surfaces; they join the
 * registry when a phase touches them.
 */

/** The product domains. Every metric, route, and panel names exactly one. */
export type DomainId =
  | "nutrition"
  | "hydration"
  | "sleep"
  | "training"
  | "body" // weight, measurements, photos (today lives at /progress)
  | "goals"
  | "plans" // training + meal plans as documents/schedules
  | "engagement" // streaks, logging consistency, milestones
  | "reports"
  | "coach" // chat, insights
  | "kitchen"
  | "future-you"
  | "quit"
  | "files"
  | "account";

export type Domain = {
  id: DomainId;
  /** The name members see TODAY (matches live nav/pages). */
  name: string;
  /** What this domain owns, in plain words. */
  owns: string;
  /**
   * Proposed target name where the overhaul audit recommends a change.
   * Status is always "pending-owner-approval" in Phase 1; applying a rename
   * is a Phase 3 task and an owner decision, never a side effect.
   */
  proposedName?: { name: string; rationale: string };
};

export const DOMAINS: Record<DomainId, Domain> = {
  nutrition: {
    id: "nutrition",
    name: "Calorie Tracker",
    owns: "meals, calories, macros, nutrition targets, food history",
    proposedName: {
      name: "Nutrition",
      rationale:
        "The domain includes macros, meals, targets, and history, not only calories; benchmark apps (MacroFactor, MyFitnessPal, Apple Health) name the domain, not one metric. LC-12/R2-6 standardized 'Calorie Tracker' before the overhaul; renaming is a P3 owner call.",
    },
  },
  hydration: {
    id: "hydration",
    name: "Hydration",
    owns: "water logging, daily goal, hydration history",
  },
  sleep: {
    id: "sleep",
    name: "Sleep",
    owns: "nightly sleep logging, sleep goal, sleep history",
  },
  training: {
    id: "training",
    name: "Workouts",
    owns: "workout execution, routines, exercise library, training history, PRs, volume",
  },
  body: {
    id: "body",
    name: "Progress",
    owns: "weight, trend weight, measurements, progress photos",
    proposedName: {
      name: "Body",
      rationale:
        "The route named Progress holds body data only. The overhaul's target architecture frees 'Progress' for the cross-domain outcome view (P5 / FIX-31/32) and names this domain Body. Documentation only until P5.",
    },
  },
  goals: {
    id: "goals",
    name: "Goals",
    owns: "goal definitions, linked outcomes, goal progress",
  },
  plans: {
    id: "plans",
    name: "Plans",
    owns: "training plan and meal plan documents and schedules",
  },
  engagement: {
    id: "engagement",
    name: "Consistency",
    owns: "streaks, weekly logging consistency, milestones",
  },
  reports: {
    id: "reports",
    name: "Weekly Report",
    owns: "weekly/monthly reviews and their evidence",
  },
  coach: {
    id: "coach",
    name: "Chat",
    owns: "the Chad conversation and evidence-backed insights",
  },
  kitchen: {
    id: "kitchen",
    name: "Rate My Kitchen",
    owns: "fridge/pantry photo grading",
  },
  "future-you": {
    id: "future-you",
    name: "Future You",
    owns: "goal-dated forecast photos",
  },
  quit: {
    id: "quit",
    name: "Quit Test",
    owns: "the quit-date prediction feature",
  },
  files: {
    id: "files",
    name: "Files",
    owns: "generated documents and uploaded photos",
  },
  account: {
    id: "account",
    name: "Account",
    owns: "billing, subscription, preferences, legal",
  },
};

/**
 * The MINIMUM TIER FOR THE ROUTE'S FULL CONTENT, mirroring lib/admin.ts gates
 * (canAccessChad / canAccessProFeatures / canAccessEliteFeatures). Two gating
 * styles exist in the live app and both mean the same access value here:
 * some routes hard-redirect below-tier members, others are reachable and
 * render an inline locked teaser (the data-state `locked` treatment). FIX-11
 * (P2) standardizes the presentation; the registry records the tier.
 */
export type RouteAccess =
  | "public" // no session required
  | "member" // any signed-in member with access (canAccessChad)
  | "pro" // canAccessProFeatures
  | "elite" // canAccessEliteFeatures
  | "admin"; // isAdminEmail

export type RouteDef = {
  path: string;
  /** The registered display name; links to this route use this name. */
  name: string;
  domain: DomainId;
  access: RouteAccess;
  /** One sentence: what a member goes here to do. */
  purpose: string;
  /**
   * In-page anchors that behave as sub-destinations today. A link that means
   * "the meal logger" must target the anchor, not the bare page.
   */
  anchors?: readonly string[];
  /**
   * Target nav group for the Phase 3 grouped navigation (proposal, not yet
   * built): primary | track | plan | review | utility.
   */
  proposedNavGroup?: "primary" | "track" | "plan" | "review" | "utility";
};

export const ROUTES = {
  "/today": {
    path: "/today",
    name: "Dashboard",
    domain: "engagement",
    access: "member",
    purpose: "See today's status, log the day, and catch what needs attention.",
    proposedNavGroup: "primary",
  },
  "/": {
    path: "/",
    name: "Chat",
    domain: "coach",
    access: "member",
    purpose: "Talk to Chad.",
    proposedNavGroup: "primary",
  },
  "/workouts": {
    path: "/workouts",
    name: "Workouts",
    domain: "training",
    access: "pro",
    purpose: "Start, log, and review training.",
    anchors: ["#history"],
    proposedNavGroup: "track",
  },
  "/workouts/new": {
    path: "/workouts/new",
    name: "New workout",
    domain: "training",
    access: "pro",
    purpose: "Build and start a workout.",
  },
  "/workouts/session": {
    path: "/workouts/session",
    name: "Live workout",
    domain: "training",
    access: "pro",
    purpose: "Run the in-progress session.",
  },
  "/workouts/history": {
    path: "/workouts/history",
    name: "Workout history",
    domain: "training",
    access: "pro",
    purpose: "Browse past sessions.",
  },
  "/workouts/history/[id]": {
    path: "/workouts/history/[id]",
    name: "Workout details",
    domain: "training",
    access: "pro",
    purpose: "One logged session in full.",
  },
  "/workouts/[id]/edit": {
    path: "/workouts/[id]/edit",
    name: "Edit workout",
    domain: "training",
    access: "pro",
    purpose: "Correct a logged session.",
  },
  "/workouts/exercises": {
    path: "/workouts/exercises",
    name: "Exercise library",
    domain: "training",
    access: "pro",
    purpose: "Browse and manage exercises.",
  },
  "/workouts/exercises/[slug]": {
    path: "/workouts/exercises/[slug]",
    name: "Exercise details",
    domain: "training",
    access: "pro",
    purpose: "One exercise's history, records, and trend.",
  },
  "/workouts/exercises/new": {
    path: "/workouts/exercises/new",
    name: "New exercise",
    domain: "training",
    access: "pro",
    purpose: "Create a custom exercise.",
  },
  "/workouts/exercises/pick": {
    path: "/workouts/exercises/pick",
    name: "Pick exercises",
    domain: "training",
    access: "pro",
    purpose: "Select exercises for a workout.",
  },
  "/nutrition": {
    path: "/nutrition",
    name: "Calorie Tracker",
    domain: "nutrition",
    access: "pro",
    purpose: "Log meals and track calories and macros against targets.",
    anchors: ["#log-meal", "#history"],
    proposedNavGroup: "track",
  },
  "/meal-plan": {
    path: "/meal-plan",
    name: "Meal Plan",
    domain: "plans",
    access: "pro",
    purpose: "View and manage the structured meal plan.",
    proposedNavGroup: "plan",
  },
  "/kitchen": {
    path: "/kitchen",
    name: "Rate My Kitchen",
    domain: "kitchen",
    access: "pro",
    purpose: "Have Chad grade a fridge or pantry photo.",
    proposedNavGroup: "utility",
  },
  "/progress": {
    path: "/progress",
    name: "Progress",
    domain: "body",
    access: "pro",
    purpose: "Track weight, trend, measurements, and progress photos.",
    anchors: ["#log-entry"],
    proposedNavGroup: "review",
  },
  "/goals": {
    path: "/goals",
    name: "Goals",
    domain: "goals",
    access: "member",
    purpose: "See and manage goals.",
    proposedNavGroup: "plan",
  },
  "/goals/new": {
    path: "/goals/new",
    name: "New goal",
    domain: "goals",
    access: "member",
    purpose: "Create a goal.",
  },
  "/goals/[id]": {
    path: "/goals/[id]",
    name: "Goal details",
    domain: "goals",
    access: "member",
    purpose: "One goal's definition, progress, and history.",
  },
  "/goals/[id]/edit": {
    path: "/goals/[id]/edit",
    name: "Edit goal",
    domain: "goals",
    access: "member",
    purpose: "Change a goal's definition.",
  },
  "/plans/[id]": {
    path: "/plans/[id]",
    name: "Plan details",
    domain: "plans",
    access: "member",
    purpose: "One plan document in full.",
  },
  "/future-you": {
    path: "/future-you",
    name: "Future You",
    domain: "future-you",
    access: "pro",
    purpose: "See forecast photos at the goal date.",
    proposedNavGroup: "review",
  },
  "/hydration": {
    path: "/hydration",
    name: "Hydration",
    domain: "hydration",
    access: "pro",
    purpose: "Log water and review hydration history.",
    proposedNavGroup: "track",
  },
  "/sleep": {
    path: "/sleep",
    name: "Sleep",
    domain: "sleep",
    access: "pro",
    purpose: "Log sleep and review sleep history.",
    proposedNavGroup: "track",
  },
  "/reports": {
    path: "/reports",
    name: "Weekly Report",
    domain: "reports",
    access: "elite",
    purpose:
      "Read the weekly review. Member-reachable; full content is Elite (canAccessEliteFeatures), lower tiers see the teaser.",
    proposedNavGroup: "review",
  },
  "/files": {
    path: "/files",
    name: "Files",
    domain: "files",
    access: "member",
    purpose: "Browse generated documents and uploads.",
    proposedNavGroup: "utility",
  },
  "/files/[id]": {
    path: "/files/[id]",
    name: "File details",
    domain: "files",
    access: "member",
    purpose: "One file, viewable and downloadable.",
  },
  "/quit-date": {
    path: "/quit-date",
    name: "Quit Test",
    domain: "quit",
    access: "member",
    purpose: "The quit-date prediction.",
    // DEC-03 (DECIDED 2026-07-13): the Quit Test's owned nav destination.
    proposedNavGroup: "utility",
  },
  "/account": {
    path: "/account",
    name: "Account",
    domain: "account",
    access: "member",
    purpose: "Manage subscription, billing, and preferences.",
    proposedNavGroup: "utility",
  },
  "/help": {
    path: "/help",
    name: "Help",
    domain: "account",
    access: "member",
    purpose: "How the product works.",
    proposedNavGroup: "utility",
  },
  "/pricing": {
    path: "/pricing",
    name: "Pricing",
    domain: "account",
    access: "public",
    purpose: "Choose a plan.",
  },
  "/welcome": {
    path: "/welcome",
    name: "Welcome",
    domain: "account",
    access: "member",
    purpose: "First-run onboarding wizard.",
  },
  "/legal": {
    path: "/legal",
    name: "Legal",
    domain: "account",
    access: "public",
    purpose: "Terms acceptance and legal documents.",
  },
} as const satisfies Record<string, RouteDef>;

export type RouteId = keyof typeof ROUTES;

/* --------------------------------------------------------------------------
 * Terminology registry
 *
 * The canonical words for concepts that appear on more than one surface.
 * A surface either uses the canonical term or does not name the concept.
 * Proposed changes carry the same pending-owner-approval discipline.
 * ------------------------------------------------------------------------ */

export type Term = {
  /** The canonical member-facing term today. */
  term: string;
  meaning: string;
  /** Words that must NOT be used for this concept. */
  never?: readonly string[];
  proposed?: { term: string; rationale: string };
};

export const TERMS: readonly Term[] = [
  {
    term: "Trend weight",
    meaning:
      "The smoothed EMA weight (lib/chart/trend.ts), the app's one canonical current weight (LC-4).",
    never: ["current weight (for the raw number)", "average weight"],
  },
  {
    term: "Scale weight",
    meaning: "A raw weigh-in as logged.",
    never: ["real weight", "actual weight"],
  },
  {
    term: "Target",
    meaning: "A daily/nightly number to hit (calories, protein, water, sleep).",
    never: ["limit", "cap"],
  },
  {
    term: "Goal",
    meaning: "A dated outcome the member is working toward.",
  },
  {
    term: "est. 1RM",
    meaning:
      "Estimated one-rep max (Epley). Always labeled estimated; methodology named at detail level.",
    never: ["1RM (unlabeled, for an estimate)"],
  },
  {
    term: "Logging consistency",
    meaning:
      "Days with at least one saved entry in any domain. Distinct from the streak.",
    never: ["active days"],
  },
  {
    term: "Streak",
    meaning:
      "Consecutive days (ending today or yesterday) with at least one logged action.",
  },
  {
    term: "Not logged",
    meaning:
      "The member-facing word for missing data. Missing is never rendered as 0. Carve-out: counts of logged events (sessions, meals-logged count, PRs) render a truthful 0; those metrics declare missingRendersAs: 'zero' in the registry.",
    never: ["0 (for unobservable missing data)", "skipped (as a system judgment)"],
  },
  {
    term: "Log a past day",
    meaning: "The backfill action, named exactly this everywhere it appears.",
    never: ["backfill (member-facing)", "manual (alone)"],
  },
] as const;
