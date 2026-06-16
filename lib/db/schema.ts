import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
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
