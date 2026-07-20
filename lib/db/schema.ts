import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  foreignKey,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  // unique: one account per email, enforced by the database — the register
  // action's check-then-insert alone has a race window where two concurrent
  // signups with the same email both pass the check and create twin accounts.
  email: varchar("email", { length: 64 }).notNull().unique(),
  password: varchar("password", { length: 64 }),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  // --- Stripe subscription (Phase 2) ---
  // The user's Stripe Customer id (created on first checkout, reused after).
  stripeCustomerId: text("stripeCustomerId"),
  // The active/most-recent Stripe Subscription id.
  stripeSubscriptionId: text("stripeSubscriptionId"),
  // Raw Stripe subscription status: trialing | active | past_due | canceled
  // | unpaid | paused | incomplete | incomplete_expired. Null = never subscribed.
  subscriptionStatus: text("subscriptionStatus"),
  // Which plan they're on, derived from the Stripe price id.
  subscriptionTier: varchar("subscriptionTier", {
    enum: ["basic", "pro", "elite"],
  }),
  // When the current paid/trial period ends (drives access + renewal display).
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  // True if they've asked to cancel but still have access until period end.
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false),
  // When the free trial ends (for trial-specific messaging).
  trialEndsAt: timestamp("trialEndsAt"),
  // --- Memory layer (Phase 3) ---
  // When true, Chad remembers this user across chats (a durable profile is
  // maintained and injected into his prompt). Default on — it's the
  // recommended experience; users can turn it off from /account.
  memoryEnabled: boolean("memoryEnabled").notNull().default(true),
  // --- /home hero figure (DSH-21) ---
  // Which decorative figure bleeds into the /home header. Null = use the
  // gender-derived default silhouette (male/female from Chad's memory "Sex",
  // falling back to male). "custom" pairs with heroImageUrl below.
  heroFigure: varchar("heroFigure", { enum: ["male", "female", "custom"] }),
  // A user-uploaded background image (Blob URL) for the /home header, used
  // when heroFigure === "custom".
  heroImageUrl: text("heroImageUrl"),
  // --- Hydration goal (DSH-24) ---
  // Daily water target in milliliters (stored in ml like the WaterLog rows, but
  // shown to the user in oz/gallons). Null = use the default of one US gallon.
  waterGoalMl: integer("waterGoalMl"),
  // --- Sleep goal (DSH-40) ---
  // Nightly sleep target in minutes (stored like SleepEntry.minutes so 7h30m
  // is exact). Null = use the recommended default of 7 hours.
  sleepGoalMinutes: integer("sleepGoalMinutes"),
  // --- Preferences (ACC-13) ---
  // Preferred body-weight unit for display + as the default for new weigh-ins.
  // Null = infer from the latest weigh-in (falling back to "lb"), so nothing
  // changes for existing users until they pick one on /account.
  weightUnit: varchar("weightUnit", { enum: ["lb", "kg"] }),
  // --- First-run onboarding (ONB-1) ---
  // When the user finished (or skipped) the first-run onboarding wizard. Null =
  // never onboarded → they get routed to /welcome once they have access.
  // Backfilled to now() for all pre-existing users by migration 0016 so only
  // genuinely new signups see the wizard.
  onboardedAt: timestamp("onboardedAt"),
  // --- Legal acceptance gate (BLK-4) ---
  // When the member confirmed they're 18+ and accepted the Terms of Service +
  // Privacy Policy. Stamped at registration for credentials signups (required
  // checkbox) and by the /legal interstitial for Google signups and accounts
  // that predate the gate. Null = must accept before using the product — every
  // product page redirects to /legal. Deliberately NOT backfilled: existing
  // members accept once on their next visit.
  acceptedTermsAt: timestamp("acceptedTermsAt"),
  // --- Editable stats / profile (ONB-2) ---
  // The client's durable, user-confirmed stats: collected at onboarding and
  // correctable anytime on /account. This is the TRUSTED source of truth for
  // who they are — injected into Chad's prompt as authoritative ground truth so
  // he's grounded in the client's own numbers, and a place to fix anything he
  // ever gets wrong. Body weight is deliberately NOT here (it's dynamic and
  // owned by the weigh-in log; duplicating it would create disagreeing numbers).
  // See lib/profile.ts for the option values, labels, and height conversions.
  sex: varchar("sex", { enum: ["male", "female"] }),
  age: integer("age"),
  // Height stored canonically in whole centimeters; shown in ft/in or cm
  // depending on the user's weightUnit preference.
  heightCm: integer("heightCm"),
  experienceLevel: varchar("experienceLevel", {
    enum: ["beginner", "intermediate", "advanced"],
  }),
  primaryGoal: varchar("primaryGoal", {
    enum: ["muscle", "fat_loss", "strength", "health"],
  }),
  // The member's full set of goal picks (owner, s157): people usually train
  // for more than one outcome, so the picker is multi-select. primaryGoal
  // above stays as the FIRST pick, mirrored on every save, for the readers
  // that want one headline goal. Null on accounts that predate this column
  // (fall back to primaryGoal).
  primaryGoals: json("primaryGoals").$type<
    ("muscle" | "fat_loss" | "strength" | "health")[]
  >(),
  trainingDaysPerWeek: integer("trainingDaysPerWeek"),
  // The member's own words about their primary goal (ONB-3): the event, the
  // deadline, the why behind the dropdown pick. Injected verbatim into Chad's
  // CONFIRMED PROFILE block so he coaches toward the real target.
  primaryGoalDetail: text("primaryGoalDetail"),
  // The member's own words about how they train (ONB-4): cardio, HIIT,
  // strength, sports, classes, or nothing yet. Same treatment as
  // primaryGoalDetail so Chad plans around it.
  trainingDescription: text("trainingDescription"),
  // --- Energy engine (calories-burned Phase 1, owner rulings 2026-07-18) ---
  // Everyday-life activity level for the TDEE multiplier (MFP semantics:
  // EXCLUDES intentional workouts — those are credited separately via METs).
  // Null = not asked yet; the onboarding question is Phase 2 UI (D6).
  activityLevel: varchar("activityLevel", {
    enum: ["sedentary", "light", "moderate", "very"],
  }),
  // Whether logged exercise raises the day's calorie budget
  // (Remaining = Target − Food + Exercise). Default ON, the MFP/LoseIt
  // behavior (D2); the settings toggle itself is Phase 3 UI.
  exerciseCalorieAddBack: boolean("exerciseCalorieAddBack")
    .notNull()
    .default(true),
  // --- Proactive check-ins (FEAT-11, Elite) ---
  // Whether Chad may email this member first (morning briefs, missed-workout
  // callouts). Default ON — it's the flagship of the Elite tier — with a
  // one-click off switch + a frequency control on /account.
  checkInsEnabled: boolean("checkInsEnabled").notNull().default(true),
  // How often Chad is allowed to reach out. "daily" = every day; the other two
  // limit him to the member's chosen checkInDays (with a rolling-7-day cap as a
  // backstop) so nobody ever feels spammed.
  checkInFrequency: varchar("checkInFrequency", {
    enum: ["daily", "three_per_week", "weekly"],
  })
    .notNull()
    .default("daily"),
  // --- Check-in schedule (FEAT-15) ---
  // The member's own concrete schedule, all on THEIR wall clock (timezone
  // below). checkInDays = which days of the week Chad may email (0 = Sunday …
  // 6 = Saturday); only consulted when frequency isn't "daily". The two hours
  // are where each slot's ~3h delivery window STARTS: the morning brief lands
  // from checkInMorningHour, the evening callout from checkInEveningHour.
  checkInDays: json("checkInDays").$type<number[]>().notNull().default([1, 3, 5]),
  checkInMorningHour: integer("checkInMorningHour").notNull().default(7),
  checkInEveningHour: integer("checkInEveningHour").notNull().default(20),
  // --- Weekly Report (FEAT-12, Elite) ---
  // Whether Chad writes this member a weekly coach's review. Default ON — like
  // check-ins, the report IS the Elite product; one-click off on /account.
  weeklyReportsEnabled: boolean("weeklyReportsEnabled").notNull().default(true),
  // When the report lands, in the member's OWN local time: day of week
  // (0 = Sunday … 6 = Saturday) + hour (0-23). Defaults to Sunday 5pm — the
  // classic "Sunday Report" — but fully customizable on /account.
  weeklyReportDay: integer("weeklyReportDay").notNull().default(0),
  weeklyReportHour: integer("weeklyReportHour").notNull().default(17),
  // IANA timezone ("America/Chicago"), captured silently from the browser when
  // the member saves their report schedule — never asked as a question. Null =
  // fall back to US Eastern. FEAT-8 will grow this into the app-wide per-user
  // timezone (captured at login) that day-bucketing + check-in crons also use.
  timezone: text("timezone"),
  // --- Sound + haptics (DSH-54) ---
  // Whether logging plays the success chime / fires a vibration on devices that
  // support it. Default ON (the reward is the point); one-click off on /account.
  soundEnabled: boolean("soundEnabled").notNull().default(true),
  hapticsEnabled: boolean("hapticsEnabled").notNull().default(true),
  // --- The Quit Date (FEAT-25) ---
  // Whether the Quit Date mechanic is on for this member (all tiers). Default
  // ON — the prediction is the retention hook. OFF hides the /home card,
  // blocks new autopsies, drops the prediction from Chad's chat + check-in
  // prompts, and skips the member in the resolution sweep and danger-window
  // escalation. Existing QuitPrediction rows are kept (the ledger survives).
  quitDateEnabled: boolean("quitDateEnabled").notNull().default(true),
  // --- Chad intensity (harshness dial) ---
  // How hard Chad goes on this member. "full" = his ruthless default
  // (profanity, insults, savage shaming); "medium" = firm, far less profanity,
  // no personal insults; "low" = still brutally honest and accountable, but no
  // cursing, no insults, never harsh. Selects which intensity block is composed
  // into his system prompt (lib/ai/prompts.ts). Default full — the recommended
  // experience; members change it from /account.
  chadIntensity: varchar("chadIntensity", {
    enum: ["full", "medium", "low"],
  })
    .notNull()
    .default("full"),
});

export type User = InferSelectModel<typeof user>;
export type CheckInFrequency = User["checkInFrequency"];

// One durable "what Chad knows about you" profile per user. Populated by a
// cheap background LLM call after chats (see lib/ai/memory.ts) and injected
// into Chad's system prompt at the start of every chat when memoryEnabled.
export const userMemory = pgTable("UserMemory", {
  userId: uuid("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id),
  // Free-form markdown summary Chad maintains himself (stats, goals, injuries,
  // current plan, progress). Capped in code; never trained on.
  profile: text("profile").notNull().default(""),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type UserMemory = InferSelectModel<typeof userMemory>;

// --- Progress tracking (Pro dashboard) ---
// A dated log of body weight and/or a progress photo, surfaced on /progress.
// One row per logged entry; an entry can be weight-only, photo-only, or both.
export const progressEntry = pgTable("ProgressEntry", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // The day this entry is for (user-chosen; defaults to today in the UI).
  recordedAt: timestamp("recordedAt").notNull(),
  // Body weight in `unit`. Null when the entry is photo-only.
  weight: doublePrecision("weight"),
  unit: varchar("unit", { enum: ["lb", "kg"] })
    .notNull()
    .default("lb"),
  // A progress photo for this entry (Vercel Blob URL). Null when weight-only.
  photoUrl: text("photoUrl"),
  // Optional free-text note ("felt strong", "post-holiday", …).
  note: text("note"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type ProgressEntry = InferSelectModel<typeof progressEntry>;

// --- Nutrition: meal / fridge / pantry photo analysis (Pro) ---
// One row per analyzed photo. Chad estimates macros and grades the food, with a
// blunt verdict in his voice. `kind` distinguishes a plate you ate (a "meal",
// which counts toward the day's intake) from an inventory shot of a "fridge" or
// "pantry" (judged for what to keep/toss/buy, not counted as eaten).
export const mealAnalysis = pgTable("MealAnalysis", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  kind: varchar("kind", { enum: ["meal", "fridge", "pantry", "other"] })
    .notNull()
    .default("meal"),
  // How this row was created: a photo Chad analyzed, or a manual macro entry.
  source: varchar("source", { enum: ["photo", "manual"] })
    .notNull()
    .default("photo"),
  // Which meal of the day this is, for the diary buckets. Null for fridge/pantry
  // shots and for older rows logged before meal categories existed. "other" is
  // a custom slot; its display name lives in mealLabel.
  meal: varchar("meal", {
    enum: ["breakfast", "lunch", "dinner", "snack", "other"],
  }),
  // Custom slot name for meal = "other" ("Post-workout shake"); shown verbatim
  // in the diary and to Chad. Null for the four standard slots.
  mealLabel: text("mealLabel"),
  // The day this meal is logged *for* (user-chosen; defaults to today). Lets a
  // user back-date a meal they forgot, and keeps the diary day-buckets honest
  // regardless of the UTC insert instant. Nullable for rows logged before this
  // existed — read it as `recordedAt ?? createdAt`.
  recordedAt: timestamp("recordedAt"),
  // The analyzed photo (Vercel Blob URL). Null for manual entries.
  photoUrl: text("photoUrl"),
  // Short label Chad gives the shot ("Double cheeseburger + fries").
  title: text("title").notNull(),
  // Estimated totals for a meal; rough or null for a fridge/pantry inventory.
  calories: doublePrecision("calories"),
  protein: doublePrecision("protein"),
  carbs: doublePrecision("carbs"),
  fat: doublePrecision("fat"),
  // 1 (garbage) … 10 (elite) — drives the at-a-glance grade.
  healthScore: integer("healthScore"),
  // Chad's blunt verdict + the foods he identified + concrete fixes. Null for
  // manual entries (the user typed their own macros, Chad didn't grade them).
  verdict: text("verdict"),
  items: json("items").notNull(),
  tips: json("tips").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type MealAnalysis = InferSelectModel<typeof mealAnalysis>;

// One daily-intake target per user (calories + protein), set on the dashboard.
// Lets the "Today's fuel" rings show progress toward a goal. Both nullable so a
// user can set just one.
export const nutritionTarget = pgTable("NutritionTarget", {
  userId: uuid("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fat: integer("fat"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type NutritionTarget = InferSelectModel<typeof nutritionTarget>;

// --- Effective-dated targets (FIX-07, P4 / DSH-66) ---
// Append-only version history for the daily nutrition target. Historical
// adherence resolves the version active on each member-local day, so changing
// a target never rewrites how past days are interpreted (the MacroFactor /
// MyFitnessPal forward-only model; see evidence-p34c/benchmark-teardown.md).
// The NutritionTarget row above stays the live "current" pointer the deployed
// code reads; every write to it now also appends a row here (one funnel:
// lib/db/queries.upsertNutritionTarget). Rows are NEVER updated or deleted.
export const nutritionTargetVersion = pgTable("NutritionTargetVersion", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // Snapshot of the full target as set (all nullable, like the live row).
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fat: integer("fat"),
  // First member-local calendar day this version applies to, stored as that
  // day's 00:00-UTC anchor (the calendarDayAnchorInTz day-key shape). The
  // version active on day D = greatest effectiveDay <= D, createdAt tiebreak.
  effectiveDay: timestamp("effectiveDay").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type NutritionTargetVersion = InferSelectModel<
  typeof nutritionTargetVersion
>;

// Same append-only version history for the single-value user-setting targets
// declared in lib/contracts/metrics.ts: the water goal (ml, User.waterGoalMl)
// and the sleep goal (minutes, User.sleepGoalMinutes). value null = "cleared,
// use the product default", which is itself a dated fact. One funnel each:
// lib/db/queries.updateUserWaterGoal / updateUserSleepGoal.
export const userTargetVersion = pgTable("UserTargetVersion", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  kind: varchar("kind", { enum: ["water", "sleep"] }).notNull(),
  // ml for water, minutes for sleep; null = revert to the default.
  value: integer("value"),
  effectiveDay: timestamp("effectiveDay").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type UserTargetVersion = InferSelectModel<typeof userTargetVersion>;

// --- Auth email flows (Phase 4): short-lived, single-use tokens ---
// Tokens are stored hashed (sha256); the raw token only ever lives in the
// emailed link. A row is deleted as soon as it's used, when it expires, and
// when the account is deleted. One active token per user per flow.
export const emailVerificationToken = pgTable("EmailVerificationToken", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  tokenHash: text("tokenHash").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type EmailVerificationToken = InferSelectModel<
  typeof emailVerificationToken
>;

export const passwordResetToken = pgTable("PasswordResetToken", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  tokenHash: text("tokenHash").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type PasswordResetToken = InferSelectModel<typeof passwordResetToken>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    // --- Files page (FEAT-45) ---
    // One-line member-facing summary shown on the /files card, written by
    // Chad at creation. Null on documents created before the Files page.
    description: text("description"),
    // Coarse bucket for /files filtering. Null = uncategorized (pre-FEAT-45).
    category: varchar("category", {
      enum: ["training", "nutrition", "recovery", "progress", "other"],
    }),
    // The chat the document was created in, for "Open source chat" on /files.
    // Null on documents created before the Files page.
    chatId: uuid("chatId"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

// A file the member uploaded in chat (photos sent to Chad). Written by the
// upload route on every upload; historic rows backfilled once from message
// attachments (scripts/backfill-user-uploads.ts). Powers the /files page.
export const userUpload = pgTable("UserUpload", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // Vercel Blob URL (unique per upload thanks to addRandomSuffix).
  url: text("url").notNull(),
  // Original filename as the member uploaded it.
  name: text("name").notNull(),
  contentType: varchar("contentType", { length: 128 }).notNull(),
  // Bytes. Null on backfilled rows (message attachments don't store size).
  size: integer("size"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type UserUpload = InferSelectModel<typeof userUpload>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// --- Goals & Plans (structured, multiple, Chad-aware) ---
// The full goal/plan text Chad (or the user) writes is stored here so the
// dashboard can show, edit, and export the real document — not just the
// one-line summary that lands in Chad's memory profile. Chad reads active
// rows in every chat (see lib/ai/memory.ts formatGoalsForPrompt).
export const goal = pgTable("Goal", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // Short label ("Lose 15 lb by summer").
  title: text("title").notNull(),
  // The full goal document (the real thing Chad wrote, not a summary).
  detail: text("detail").notNull().default(""),
  // Free-text target date ("Aug 2026", "12 weeks"). Nullable.
  targetDate: text("targetDate"),
  status: varchar("status", { enum: ["active", "achieved", "archived"] })
    .notNull()
    .default("active"),
  // Who created it. A Chad-made goal records the chat it came from.
  source: varchar("source", { enum: ["user", "chad"] })
    .notNull()
    .default("user"),
  sourceChatId: uuid("sourceChatId"),
  // Measurable target (optional) — lets a goal render live progress.
  metric: varchar("metric", {
    enum: ["weight", "bodyfat", "measurement", "custom", "lift"],
  }),
  // Which entity the metric refers to, when it isn't implied. For a "lift" goal
  // this is the exercise name (e.g. "Back Squat") whose est. 1RM is tracked
  // against the target, charted from the PR data already collected. Null for
  // metrics that need no reference (weight, body-fat %).
  metricRef: text("metricRef"),
  startValue: doublePrecision("startValue"),
  // Latest value for metrics with no automatic data source (bodyfat,
  // measurement, custom) — the member updates it by hand. Weight and lift
  // goals ignore it: their "current" comes from weigh-ins / logged sets.
  currentValue: doublePrecision("currentValue"),
  targetValue: doublePrecision("targetValue"),
  unit: text("unit"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Goal = InferSelectModel<typeof goal>;

export const plan = pgTable("Plan", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  // The full plan document (e.g. the actual 4-day split Chad wrote).
  detail: text("detail").notNull().default(""),
  kind: varchar("kind", { enum: ["training", "diet"] })
    .notNull()
    .default("training"),
  status: varchar("status", { enum: ["active", "achieved", "archived"] })
    .notNull()
    .default("active"),
  source: varchar("source", { enum: ["user", "chad"] })
    .notNull()
    .default("user"),
  sourceChatId: uuid("sourceChatId"),
  // Structured training days (PlanDay[] — see lib/validation/plan-days.ts) so
  // a training plan is RUNNABLE in the workout logger ("Start Day 2" pre-fills
  // the exercises), not just a document. Null for diet plans and for older
  // free-text plans; those are backfilled on demand by an AI extraction pass
  // over `detail` (app/workouts/actions.ts `syncPlanDays`).
  days: json("days"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Plan = InferSelectModel<typeof plan>;

// --- Structured training plans (FIX-28, P4) ---
// The normalized schedule behind a training plan: PlanSession (one prescribed
// session in the rotation) -> PlanSessionExercise -> PlanSessionSet, plus
// PlanSessionCompletion (the event stream linking logged Workouts back to the
// prescribed session they completed). Modeled on Hevy's routine schema
// (set-level prescriptions, exercise-level rest/superset) inside a
// Boostcamp-style rotation container; see
// evidence-p34d/benchmark-teardown.md. DEC-06: `Plan.detail` (the raw
// document) and `Plan.days` (the legacy json) are never rewritten; these
// tables are materialized FROM them by lib/plans/schedule.ts, lazily, the
// syncPlanDays idiom. Rows are UPSERTED by (planId, position) so their ids
// stay stable across plan edits; sessions removed by an edit flip
// `active=false` rather than being deleted (completion history survives).
export const planSession = pgTable(
  "PlanSession",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    planId: uuid("planId")
      .notNull()
      .references(() => plan.id),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    // Rotation order, 0-based. The schedule is a repeating rotation (the
    // category consensus: a missed Tuesday means the session happens
    // Wednesday), never calendar-dated rows.
    position: integer("position").notNull().default(0),
    // "Day 1: Upper" — the label the member taps to start.
    name: text("name").notNull(),
    // 0=Sunday..6=Saturday when a plan pins this session to a weekday
    // (MacroFactor/Apple pattern). Null = pure rotation (the default; nothing
    // Chad saves today sets it).
    weekday: integer("weekday"),
    // Soft removal: re-materialization never deletes rows, so completion FKs
    // and P34-E plan-exercise references survive plan edits.
    active: boolean("active").notNull().default(true),
    // Hash of the source days json this materialization came from; the
    // adapter re-materializes when the plan's current source hash differs.
    sourceHash: text("sourceHash").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    // One row per rotation slot; the materializer upserts on this target so
    // concurrent lazy materializations cannot double-insert a position.
    planPositionUnique: uniqueIndex("PlanSession_planId_position_unique").on(
      table.planId,
      table.position
    ),
  })
);

export type PlanSession = InferSelectModel<typeof planSession>;

export const planSessionExercise = pgTable("PlanSessionExercise", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  planSessionId: uuid("planSessionId")
    .notNull()
    .references(() => planSession.id),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // Order within the session.
  position: integer("position").notNull().default(0),
  // Library-canonical casing (lib/workouts/exercise-library.ts), the same
  // name-snapshot join the workout log uses. THE join point for P34-E's
  // exercise-identity work.
  exerciseName: text("exerciseName").notNull(),
  // The prescription AS CHAD WROTE IT: working-set count plus the expressive
  // reps string ("4-6", "8-12", "AMRAP", "45s", "5 per side"). This pair is
  // the raw/display form; PlanSessionSet below is the structured expansion.
  sets: integer("sets").notNull(),
  reps: text("reps").notNull(),
  // Prescribed load, only when the plan names one.
  weight: doublePrecision("weight"),
  unit: varchar("unit", { enum: ["lb", "kg"] }).notNull().default("lb"),
  // Short cue: "RPE 8", "3 min rest", "slow negative".
  note: text("note"),
  // Rest between sets, seconds. Exercise-level like Hevy/Strong, not per set.
  restSeconds: integer("restSeconds"),
  // Exercises sharing a non-null group value are one superset (Hevy's
  // supersets_id pattern). Null = straight sets.
  supersetGroup: integer("supersetGroup"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type PlanSessionExercise = InferSelectModel<
  typeof planSessionExercise
>;

// Set-level prescription rows (Hevy RoutineSet shape). Materialized from the
// per-exercise prescription: "4 x 8-12" becomes four `normal` rows with
// repRange 8-12. Fields are nullable-everything on purpose so a set can
// prescribe anything from "just do a set" to "8-12 @ 185 lb, RPE 8"; the
// unparseable remainder ("5 per side") keeps nulls here and renders from the
// exercise row's raw reps string.
export const planSessionSet = pgTable("PlanSessionSet", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  planSessionExerciseId: uuid("planSessionExerciseId")
    .notNull()
    .references(() => planSessionExercise.id),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  position: integer("position").notNull().default(0),
  type: varchar("type", {
    enum: ["warmup", "normal", "failure", "dropset"],
  })
    .notNull()
    .default("normal"),
  // Fixed reps OR a rep range, never both (validation-layer invariant).
  reps: integer("reps"),
  repRangeStart: integer("repRangeStart"),
  repRangeEnd: integer("repRangeEnd"),
  weight: doublePrecision("weight"),
  // Timed work ("45s" prescriptions), seconds.
  durationSeconds: integer("durationSeconds"),
  rpe: doublePrecision("rpe"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type PlanSessionSet = InferSelectModel<typeof planSessionSet>;

// The completion EVENT stream: one row when a logged workout completes a
// prescribed session (the generalization of Hevy's workout.routine_id).
// Powers adherence (planned-vs-completed, the TrainingPeaks model), Up next
// (first active session in the rotation without a completion this cycle),
// and P5/P6 milestone/reward moments (timestamped events). Events are
// immutable history: a later plan edit never rewrites them (the FIX-07
// philosophy), and `sessionName` snapshots the label at completion time so
// history renders honestly even after renames (the WorkoutExercise idiom).
export const planSessionCompletion = pgTable(
  "PlanSessionCompletion",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    // Denormalized for cheap per-plan adherence queries.
    planId: uuid("planId")
      .notNull()
      .references(() => plan.id),
    planSessionId: uuid("planSessionId")
      .notNull()
      .references(() => planSession.id),
    workoutId: uuid("workoutId")
      .notNull()
      .references(() => workout.id),
    sessionName: text("sessionName").notNull(),
    // The member-local day the completion counts toward (00:00-UTC calendar
    // anchor via lib/date.ts calendarDayAnchorInTz, matching the write in
    // app/workouts/actions.ts and the week-strip windows).
    completedDay: timestamp("completedDay").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    // A logged workout completes at most one prescribed session; the insert
    // is onConflictDoNothing on this, so a double-submitted save stays one
    // completion event.
    workoutUnique: uniqueIndex("PlanSessionCompletion_workoutId_unique").on(
      table.workoutId
    ),
  })
);

export type PlanSessionCompletion = InferSelectModel<
  typeof planSessionCompletion
>;


// --- Goal outcomes (FIX-29, P4): a goal linked to N measurable outcomes ---
// The legacy Goal row carries at most ONE outcome (its `metric` enum). This
// table lets one goal track several ("lose 15 lb AND bench 225"), each either
// pinned to a REGISTERED metric from lib/contracts/metrics.ts (the outcome
// vocabulary; validated in lib/validation/goals.ts, the DB stores text) or
// explicitly UNSUPPORTED (metricId null + a member-facing label), so a goal
// never silently pretends the app can measure something it cannot. Legacy
// single-metric goals are ADAPTED to this shape at read time
// (lib/goals/outcomes.ts); their rows are never rewritten.
export const goalOutcome = pgTable("GoalOutcome", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  goalId: uuid("goalId")
    .notNull()
    .references(() => goal.id),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // Display order; 0 is the goal's primary outcome.
  position: integer("position").notNull().default(0),
  // A registered MetricId ("body.weight.trend", "training.exercise.e1rm").
  // Null = the app cannot measure this outcome; `label` carries the wording
  // and `currentValue` is member-maintained.
  metricId: text("metricId"),
  // The entity the metric refers to when it isn't implied: exercise name for
  // training.exercise.e1rm, measurement kind for body.measurement.
  metricRef: text("metricRef"),
  // Member-facing outcome wording; required when metricId is null.
  label: text("label"),
  startValue: doublePrecision("startValue"),
  targetValue: doublePrecision("targetValue"),
  // Manual current value for unsupported outcomes only; registered metrics
  // read their one source module (one-canonical-value law).
  currentValue: doublePrecision("currentValue"),
  unit: text("unit"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type GoalOutcome = InferSelectModel<typeof goalOutcome>;

// --- Body measurements (a progress dimension beyond bodyweight) ---
// One row per recorded measurement; a per-metric trend is built from the rows.
export const bodyMeasurement = pgTable("BodyMeasurement", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  recordedAt: timestamp("recordedAt").notNull(),
  kind: varchar("kind", {
    enum: ["waist", "chest", "arms", "hips", "thighs", "shoulders", "neck"],
  }).notNull(),
  value: doublePrecision("value").notNull(),
  unit: varchar("unit", { enum: ["in", "cm"] })
    .notNull()
    .default("in"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type BodyMeasurement = InferSelectModel<typeof bodyMeasurement>;

// --- Water log (a lightweight daily diary staple) ---
// One row per increment logged; summed per day for the counter on /home.
export const waterLog = pgTable("WaterLog", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  recordedAt: timestamp("recordedAt").notNull(),
  amountMl: integer("amountMl").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type WaterLog = InferSelectModel<typeof waterLog>;

// --- Sleep log (a recovery staple, like Whoop/Oura/Apple Health) ---
// One row per night. Unlike water (many increments summed per day), sleep is a
// single value per night — `createSleepEntry` replaces any existing row for the
// same calendar day so re-logging a night overwrites it rather than stacking.
// `recordedAt` is the night anchored at noon UTC (the `lib/date.ts` convention);
// `minutes` is total time asleep; `quality` is an optional 1–5 self-rating.
export const sleepEntry = pgTable("SleepEntry", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // The night this entry is for (user-chosen; defaults to today in the UI).
  recordedAt: timestamp("recordedAt").notNull(),
  // Total minutes asleep (stored in minutes so 7h30m is exact, not a 7.5 float).
  minutes: integer("minutes").notNull(),
  // Optional self-rated sleep quality, 1 (poor) … 5 (great).
  quality: integer("quality"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type SleepEntry = InferSelectModel<typeof sleepEntry>;

// --- Workout logging (executed sets/reps/weight, like Hevy/Strong) ---
// A workout is a dated training session. Its exercises and their sets hang off
// it (WorkoutExercise → WorkoutSet), so the dashboard can show the full thing,
// compute PRs / volume, and let Chad reference what was actually trained. Every
// child row also carries userId so deletes/queries stay cheaply owner-scoped.
export const workout = pgTable("Workout", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // Session label, e.g. "Push Day" or "Legs".
  title: text("title").notNull(),
  // When the session was trained (user-chosen; defaults to now in the UI).
  performedAt: timestamp("performedAt").notNull(),
  // Optional session length in seconds (from the in-app timer or typed in).
  durationSeconds: integer("durationSeconds"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Workout = InferSelectModel<typeof workout>;

// One exercise performed within a workout. `exerciseName` + `muscleGroup` are
// stored as a snapshot (not an FK to a library row) so the log is stable even
// if a custom exercise is later renamed or deleted, and so PRs/trends can group
// by name across sessions.
export const workoutExercise = pgTable("WorkoutExercise", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  workoutId: uuid("workoutId")
    .notNull()
    .references(() => workout.id),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  exerciseName: text("exerciseName").notNull(),
  muscleGroup: text("muscleGroup"),
  // How this exercise is logged — snapshot like the name, so history renders
  // honestly even if the library entry changes later. "weighted" = load × reps,
  // "bodyweight" = reps (added load optional), "timed" = seconds per set (the
  // set's `reps` column holds seconds). Null on rows logged before this existed
  // (treated as weighted).
  kind: varchar("kind", { enum: ["weighted", "bodyweight", "timed"] }),
  // Order within the workout.
  position: integer("position").notNull().default(0),
  // Superset/circuit grouping (FEAT-10): consecutive exercises sharing the
  // same number were performed back-to-back as one superset. Numbered 1, 2, …
  // within the workout; null = a normal standalone exercise.
  supersetGroup: integer("supersetGroup"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type WorkoutExercise = InferSelectModel<typeof workoutExercise>;

// One set of one exercise. Weight is null for bodyweight moves; reps null for
// timed work. `setType` distinguishes warmups from working sets so they don't
// pollute PRs. `completed` mirrors the checkbox in the logger.
export const workoutSet = pgTable("WorkoutSet", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  workoutExerciseId: uuid("workoutExerciseId")
    .notNull()
    .references(() => workoutExercise.id),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  position: integer("position").notNull().default(0),
  weight: doublePrecision("weight"),
  unit: varchar("unit", { enum: ["lb", "kg"] })
    .notNull()
    .default("lb"),
  reps: integer("reps"),
  // Rate of perceived exertion (6–10), optional.
  rpe: doublePrecision("rpe"),
  setType: varchar("setType", {
    enum: ["warmup", "working", "dropset", "failure"],
  })
    .notNull()
    .default("working"),
  completed: boolean("completed").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type WorkoutSet = InferSelectModel<typeof workoutSet>;

// A user's own exercises, added when the built-in library (a static catalog in
// lib/workouts/exercise-library.ts) doesn't have what they want. The picker
// shows the built-ins plus these.
export const customExercise = pgTable("CustomExercise", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  muscleGroup: varchar("muscleGroup", {
    enum: [
      "chest",
      "back",
      "legs",
      "shoulders",
      "arms",
      "core",
      "glutes",
      "fullBody",
      "cardio",
      "other",
    ],
  })
    .notNull()
    .default("other"),
  equipment: varchar("equipment", {
    enum: [
      "barbell",
      "dumbbell",
      "machine",
      "cable",
      "bodyweight",
      "kettlebell",
      "bands",
      "other",
    ],
  })
    .notNull()
    .default("other"),
  // How the exercise is logged (the Hevy/Strong "exercise type"): weighted =
  // load × reps, bodyweight = reps with optional added load, timed = seconds.
  kind: varchar("kind", { enum: ["weighted", "bodyweight", "timed"] })
    .notNull()
    .default("weighted"),
  // Optional setup/form cues ("seat at 4, slow negative").
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type CustomExercise = InferSelectModel<typeof customExercise>;


// Canonical exercise identity (FIX-34). Maps a logged name variant onto ONE
// canonical exercise so records/PRs stop splitting across aliases ("Bench
// Press" vs "Barbell Bench Press"). Resolution happens at READ time when stats
// group exercises (lib/workouts/exercise-identity.ts); WorkoutExercise rows
// are never rewritten, so removing a row un-merges. The curated global set
// ships in code; this table holds member-scoped mappings (a member merging
// their own custom exercise into another) plus any future global overrides.
// Only status "approved" rows participate in resolution.
export const exerciseAlias = pgTable("ExerciseAlias", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  // Null = global mapping; set = scoped to this member's log only.
  userId: uuid("userId").references(() => user.id),
  // The name variant, stored normalized (normalizeExerciseKey).
  alias: text("alias").notNull(),
  // The canonical display name records group under.
  canonicalName: text("canonicalName").notNull(),
  source: varchar("source", { enum: ["curated", "member"] })
    .notNull()
    .default("member"),
  status: varchar("status", { enum: ["proposed", "approved", "rejected"] })
    .notNull()
    .default("proposed"),
  confidence: varchar("confidence", { enum: ["high", "medium"] }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  decidedAt: timestamp("decidedAt"),
});

export type ExerciseAlias = InferSelectModel<typeof exerciseAlias>;


// --- Structured meal plans (Pro) ---
// A multi-day meal plan Chad (or the user) generates. Unlike the markdown `plan`
// table (which holds free-text training/diet plans), a meal plan is fully
// STRUCTURED: days → meals → foods, with macros that come from the USDA food
// database (computed in code), never AI-estimated. The shape of `days` and
// `preferences` is defined + validated in lib/validation/meal-plan.ts.
export const mealPlan = pgTable("MealPlan", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // "2,200 kcal cut — 4 meals/day".
  title: text("title").notNull(),
  status: varchar("status", { enum: ["active", "archived"] })
    .notNull()
    .default("active"),
  source: varchar("source", { enum: ["user", "chad"] })
    .notNull()
    .default("chad"),
  sourceChatId: uuid("sourceChatId"),
  // The macro target this plan was built to hit (snapshot at generation time).
  targetCalories: integer("targetCalories"),
  targetProtein: integer("targetProtein"),
  targetCarbs: integer("targetCarbs"),
  targetFat: integer("targetFat"),
  // Generation inputs (diet style, allergies, dislikes, meals/day, budget,
  // cook-time, notes) so the plan can be regenerated with the same constraints.
  preferences: json("preferences").notNull(),
  // Chad's blunt voice intro / strategy explainer for this plan.
  coachIntro: text("coachIntro").notNull().default(""),
  // The structured plan: days[] → meals[] → foods[], with DB-verified macros
  // and per-meal/per-day totals baked in. See lib/validation/meal-plan.ts.
  days: json("days").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type MealPlan = InferSelectModel<typeof mealPlan>;

// --- Proactive check-ins (FEAT-11, Elite) ---
// One row per check-in email Chad actually sent. This is the dedup + frequency
// ledger: the cron pass consults it so a user never gets the same slot twice in
// a day and never exceeds their chosen weekly frequency — and it keeps the full
// text so a future in-app "check-in history" can render what Chad said.
export const checkIn = pgTable("CheckIn", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // Which cron pass produced it: the morning brief or the evening callout.
  slot: varchar("slot", { enum: ["morning", "evening"] }).notNull(),
  subject: text("subject").notNull(),
  // The plain-text body as composed (pre-HTML-templating).
  body: text("body").notNull(),
  sentAt: timestamp("sentAt").notNull().defaultNow(),
});

export type CheckIn = InferSelectModel<typeof checkIn>;

// --- Weekly Report (FEAT-12, Elite) ---
// One row per weekly coach's report Chad wrote. The row IS the artifact: the
// /reports page and the PDF render `content` (structured sections + next week's
// adjustments), and the row doubles as the dedup ledger so the hourly cron can
// never send two reports in one week.
export const weeklyReport = pgTable("WeeklyReport", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // The email subject line, in Chad's voice.
  subject: text("subject").notNull(),
  // WeeklyReportContent (see lib/reports/content.ts): headline, intro,
  // sections, next week's adjustments with reasons, bottom line.
  content: json("content").notNull(),
  sentAt: timestamp("sentAt").notNull().defaultNow(),
});

export type WeeklyReport = InferSelectModel<typeof weeklyReport>;

/**
 * A generated progress-photo montage (FEAT-18): Chad's side-by-side timeline
 * read of the client's real photos. Stores the CONTENT (selected frames +
 * Chad's captions + verdict), not a rendered image — the composite itself is
 * drawn client-side from the member's real Blob photos (data-layer honesty:
 * nothing ever redraws their body). Also the fair-use ledger for the
 * montage generator (lib/montage/limit.ts window-counts this table).
 */
export const progressMontage = pgTable("ProgressMontage", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // ProgressMontageContent (see lib/montage/content.ts): frames (photo URL,
  // date + weight labels, Chad's caption) and the overall verdict.
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type ProgressMontage = InferSelectModel<typeof progressMontage>;

/**
 * The Quit Date (FEAT-21): Chad's on-the-record prediction of the exact day
 * this member quits, issued from their own confessed failure history (The
 * Autopsy) by deterministic heuristics, with the narrative written in Chad's
 * voice. Doubles as the predicted-vs-actual ledger: FEAT-22 resolves rows to
 * "beaten" (kept logging past the date) or "hit" (went silent), stamping
 * resolvedAt, so announced predictions plus outcomes accumulate ground truth.
 */
export const quitPrediction = pgTable("QuitPrediction", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  predictedAt: timestamp("predictedAt").notNull().defaultNow(),
  // The predicted quit day as a noon-UTC calendar-day anchor, computed on the
  // member's own wall clock (todayAnchorInTz + the heuristic day count).
  quitDate: timestamp("quitDate").notNull(),
  // Short label of HOW they are predicted to fail (from lib/quit/heuristics.ts).
  failureMode: text("failureMode").notNull(),
  status: varchar("status", { enum: ["active", "beaten", "hit"] })
    .notNull()
    .default("active"),
  resolvedAt: timestamp("resolvedAt"),
  // QuitPredictionContent (see lib/quit/content.ts): the intake answers,
  // computed day count and date label, failure mode, and Chad's narrative.
  content: json("content").notNull(),
});

export type QuitPrediction = InferSelectModel<typeof quitPrediction>;

// --- Workout templates (the member-built "My Workouts" plans) ---
// A template is a reusable workout PLAN the member builds ahead of time
// ("Push Day": bench 3×8, rows 3×10 …). Starting one spawns a live session in
// the player; finishing that session writes Workout/WorkoutExercise/WorkoutSet
// rows as usual, so history, PRs, and Chad's dashboard reads are unchanged.
// `exercises` is a TemplateExercise[] (see lib/validation/workout-templates.ts):
// name/muscleGroup/kind snapshots plus targetSets, rep range, and rest seconds.
export const workoutTemplate = pgTable("WorkoutTemplate", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  exercises: json("exercises").notNull(),
  // Stamped each time a session started from this template is saved, so the
  // list can show "Last done Tuesday".
  lastPerformedAt: timestamp("lastPerformedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type WorkoutTemplate = InferSelectModel<typeof workoutTemplate>;

/**
 * A Future You forecast (FEAT-29): photorealistic photos of what this member
 * will look like at each dated checkpoint on the way to their active goal,
 * generated from their own submitted photos (gpt-image-2 edits with the
 * member's photos as identity references), plus one "if you quit" frame at
 * the goal date. Unlike the Progress Montage (which never redraws a body),
 * every image here IS generated; the copy frames each frame confidently as a
 * calculated forecast (owner order s175: no timid AI-labeling), and frames
 * live in their own table so they never mix into the progress-photo history.
 *
 * Generation runs in the background after the start action returns (the page
 * polls), so `status` drives the UI: pending → ready | failed. The row is also
 * the fair-use ledger (lib/future-you/limit.ts window-counts this table).
 */
export const futureYouForecast = pgTable("FutureYouForecast", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // The active goal the projection is computed against (checkpoint math and
  // the image prompts both derive from it).
  goalId: uuid("goalId")
    .notNull()
    .references(() => goal.id),
  status: varchar("status", { enum: ["pending", "ready", "failed"] })
    .notNull()
    .default("pending"),
  // The member's submitted source photos (Vercel Blob URLs, 3-6), kept so a
  // ready forecast can always show what it was generated from.
  sourcePhotoUrls: json("sourcePhotoUrls").$type<string[]>().notNull(),
  // FutureYouContent (see lib/future-you/content.ts): Chad's physique read,
  // the dated work frames + the quit frame (generated image URLs + captions),
  // and his closing verdict. Null until status is "ready".
  content: json("content"),
  // Member-facing failure message when status is "failed".
  error: text("error"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type FutureYouForecast = InferSelectModel<typeof futureYouForecast>;
