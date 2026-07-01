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
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
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
  // --- /today hero figure (DSH-21) ---
  // Which decorative figure bleeds into the /today header. Null = use the
  // gender-derived default silhouette (male/female from Chad's memory "Sex",
  // falling back to male). "custom" pairs with heroImageUrl below.
  heroFigure: varchar("heroFigure", { enum: ["male", "female", "custom"] }),
  // A user-uploaded background image (Blob URL) for the /today header, used
  // when heroFigure === "custom".
  heroImageUrl: text("heroImageUrl"),
  // --- Hydration goal (DSH-24) ---
  // Daily water target in milliliters (stored in ml like the WaterLog rows, but
  // shown to the user in oz/gallons). Null = use the default of one US gallon.
  waterGoalMl: integer("waterGoalMl"),
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
  trainingDaysPerWeek: integer("trainingDaysPerWeek"),
  // --- Proactive check-ins (FEAT-11, Elite) ---
  // Whether Chad may email this member first (morning briefs, missed-workout
  // callouts). Default ON — it's the flagship of the Elite tier — with a
  // one-click off switch + a frequency control on /account.
  checkInsEnabled: boolean("checkInsEnabled").notNull().default(true),
  // How often Chad is allowed to reach out. "daily" = up to a morning brief +
  // an evening callout per day; the other two are rolling-7-day send caps so
  // nobody ever feels spammed.
  checkInFrequency: varchar("checkInFrequency", {
    enum: ["daily", "three_per_week", "weekly"],
  })
    .notNull()
    .default("daily"),
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
  kind: varchar("kind", { enum: ["meal", "fridge", "pantry"] })
    .notNull()
    .default("meal"),
  // How this row was created: a photo Chad analyzed, or a manual macro entry.
  source: varchar("source", { enum: ["photo", "manual"] })
    .notNull()
    .default("photo"),
  // Which meal of the day this is, for the diary buckets. Null for fridge/pantry
  // shots and for older rows logged before meal categories existed.
  meal: varchar("meal", { enum: ["breakfast", "lunch", "dinner", "snack"] }),
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
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

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
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Plan = InferSelectModel<typeof plan>;

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
// One row per increment logged; summed per day for the counter on /today.
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
  // Order within the workout.
  position: integer("position").notNull().default(0),
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
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type CustomExercise = InferSelectModel<typeof customExercise>;

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
