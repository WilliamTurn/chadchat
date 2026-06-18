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
  subscriptionTier: varchar("subscriptionTier", { enum: ["basic", "pro"] }),
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
});

export type User = InferSelectModel<typeof user>;

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
  // The analyzed photo (Vercel Blob URL).
  photoUrl: text("photoUrl").notNull(),
  // Short label Chad gives the shot ("Double cheeseburger + fries").
  title: text("title").notNull(),
  // Estimated totals for a meal; rough or null for a fridge/pantry inventory.
  calories: doublePrecision("calories"),
  protein: doublePrecision("protein"),
  carbs: doublePrecision("carbs"),
  fat: doublePrecision("fat"),
  // 1 (garbage) … 10 (elite) — drives the at-a-glance grade.
  healthScore: integer("healthScore"),
  // Chad's blunt verdict + the foods he identified + concrete fixes.
  verdict: text("verdict").notNull(),
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
