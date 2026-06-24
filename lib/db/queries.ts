import "server-only";

import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { ChatbotError } from "../errors";
import { generateUUID } from "../utils";
import {
  type Chat,
  chat,
  type DBMessage,
  document,
  emailVerificationToken,
  type MealAnalysis,
  mealAnalysis,
  message,
  type NutritionTarget,
  nutritionTarget,
  passwordResetToken,
  type ProgressEntry,
  progressEntry,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  type UserMemory,
  userMemory,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function getUserById(id: string): Promise<User | undefined> {
  try {
    const [found] = await db.select().from(user).where(eq(user.id, id));
    return found;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get user by id");
  }
}

export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const hashedPassword = generateHashedPassword(newPassword);
  try {
    await db
      .update(user)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(user.id, userId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update password"
    );
  }
}

export async function markEmailVerified(userId: string): Promise<void> {
  try {
    await db
      .update(user)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(user.id, userId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to mark email verified"
    );
  }
}

// --- Email verification tokens ---

export async function createEmailVerificationToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  try {
    // One active token per user — clear any prior one first.
    await db
      .delete(emailVerificationToken)
      .where(eq(emailVerificationToken.userId, userId));
    await db
      .insert(emailVerificationToken)
      .values({ userId, tokenHash, expiresAt });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create verification token"
    );
  }
}

/** Look up + delete a verification token; returns the userId only if unexpired. */
export async function consumeEmailVerificationToken(
  tokenHash: string
): Promise<string | null> {
  try {
    const [row] = await db
      .select()
      .from(emailVerificationToken)
      .where(eq(emailVerificationToken.tokenHash, tokenHash));

    if (!row) {
      return null;
    }

    // Single-use: delete whether or not it was still valid.
    await db
      .delete(emailVerificationToken)
      .where(eq(emailVerificationToken.id, row.id));

    if (row.expiresAt.getTime() < Date.now()) {
      return null;
    }

    return row.userId;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to consume verification token"
    );
  }
}

// --- Password reset tokens ---

export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  try {
    await db
      .delete(passwordResetToken)
      .where(eq(passwordResetToken.userId, userId));
    await db
      .insert(passwordResetToken)
      .values({ userId, tokenHash, expiresAt });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create reset token"
    );
  }
}

/** Look up + delete a reset token; returns the userId only if unexpired. */
export async function consumePasswordResetToken(
  tokenHash: string
): Promise<string | null> {
  try {
    const [row] = await db
      .select()
      .from(passwordResetToken)
      .where(eq(passwordResetToken.tokenHash, tokenHash));

    if (!row) {
      return null;
    }

    await db
      .delete(passwordResetToken)
      .where(eq(passwordResetToken.id, row.id));

    if (row.expiresAt.getTime() < Date.now()) {
      return null;
    }

    return row.userId;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to consume reset token"
    );
  }
}

export async function getUserByStripeCustomerId(
  stripeCustomerId: string
): Promise<User | undefined> {
  try {
    const [found] = await db
      .select()
      .from(user)
      .where(eq(user.stripeCustomerId, stripeCustomerId));
    return found;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by Stripe customer id"
    );
  }
}

export async function setUserStripeCustomerId(
  userId: string,
  stripeCustomerId: string
) {
  try {
    return await db
      .update(user)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(user.id, userId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to set Stripe customer id"
    );
  }
}

// --- Memory layer (Phase 3) ---

/** The user's durable memory profile, or undefined if none yet. */
export async function getUserMemory(
  userId: string
): Promise<UserMemory | undefined> {
  try {
    const [found] = await db
      .select()
      .from(userMemory)
      .where(eq(userMemory.userId, userId));
    return found;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get user memory");
  }
}

/** Insert or replace the user's memory profile (one row per user). */
export async function upsertUserMemory(userId: string, profile: string) {
  try {
    return await db
      .insert(userMemory)
      .values({ userId, profile, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userMemory.userId,
        set: { profile, updatedAt: new Date() },
      });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save user memory"
    );
  }
}

/** Flip the per-user memory toggle. */
export async function setMemoryEnabled(userId: string, enabled: boolean) {
  try {
    return await db
      .update(user)
      .set({ memoryEnabled: enabled, updatedAt: new Date() })
      .where(eq(user.id, userId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update memory setting"
    );
  }
}

/** Wipe the user's stored profile (privacy / reset). Leaves the toggle as-is. */
export async function clearUserMemory(userId: string) {
  try {
    return await db
      .delete(userMemory)
      .where(eq(userMemory.userId, userId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to clear user memory"
    );
  }
}

type SubscriptionUpdate = {
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionTier: "basic" | "pro" | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
};

/** Sync a user's subscription columns from a Stripe webhook, keyed by customer id. */
export async function updateUserSubscriptionByCustomerId(
  stripeCustomerId: string,
  data: SubscriptionUpdate
) {
  try {
    return await db
      .update(user)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(user.stripeCustomerId, stripeCustomerId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update subscription"
    );
  }
}

// --- Admin: manual (comped) access grants, not tied to Stripe ---

export type ManualGrantResult =
  | { ok: true; user: User }
  | { ok: false; reason: "not_found" };

/**
 * Manually set a user's access by email, bypassing Stripe — for comping
 * friends, testers, or fixing a botched signup from the admin dashboard.
 *
 * - tier "basic" | "pro": marks the subscription "active" with no period end
 *   (an indefinite comp). hasActiveAccess() then returns true, so the paywall
 *   lets them in. Stripe ids are left untouched, so if they later subscribe for
 *   real, the webhook simply takes over.
 * - tier null: revokes access (status + tier cleared). Their chat history and
 *   any Stripe customer id are kept.
 *
 * Returns the updated user, or not_found if no account has that email.
 */
export async function setManualSubscriptionByEmail(
  email: string,
  tier: "basic" | "pro" | null
): Promise<ManualGrantResult> {
  try {
    const normalized = email.trim().toLowerCase();
    const [existing] = await db
      .select()
      .from(user)
      .where(eq(user.email, normalized));

    if (!existing) {
      return { ok: false, reason: "not_found" };
    }

    const [updated] = await db
      .update(user)
      .set({
        subscriptionTier: tier,
        subscriptionStatus: tier ? "active" : null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(user.id, existing.id))
      .returning();

    return { ok: true, user: updated };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to set manual subscription"
    );
  }
}

export type DeleteUserResult =
  | { ok: true; email: string }
  | { ok: false; reason: "not_found" };

/**
 * Permanently delete a user and everything they own: their chats (and the
 * votes, messages, and streams under those chats), documents, suggestions, and
 * memory profile, then the User row itself. Children are removed before parents
 * to satisfy the foreign keys, and the whole thing runs in one transaction so a
 * failure can never leave a half-deleted account behind.
 *
 * NOTE: this is DB-only — it does NOT touch Stripe. A real subscriber should be
 * cancelled in Stripe first; for throwaway test accounts (the main use) there's
 * usually nothing in Stripe to clean up. Deleting frees the email to register
 * again.
 */
export async function deleteUserByEmail(
  email: string
): Promise<DeleteUserResult> {
  try {
    const normalized = email.trim().toLowerCase();
    const [existing] = await db
      .select()
      .from(user)
      .where(eq(user.email, normalized));

    if (!existing) {
      return { ok: false, reason: "not_found" };
    }

    const userId = existing.id;

    await db.transaction(async (tx) => {
      // The user's chats and everything hanging off them, in FK-safe order.
      const userChats = await tx
        .select({ id: chat.id })
        .from(chat)
        .where(eq(chat.userId, userId));
      const chatIds = userChats.map((c) => c.id);

      if (chatIds.length > 0) {
        await tx.delete(vote).where(inArray(vote.chatId, chatIds));
        await tx.delete(message).where(inArray(message.chatId, chatIds));
        await tx.delete(stream).where(inArray(stream.chatId, chatIds));
        await tx.delete(chat).where(eq(chat.userId, userId));
      }

      // Suggestions reference both the user and documents — remove them first.
      await tx.delete(suggestion).where(eq(suggestion.userId, userId));
      await tx.delete(document).where(eq(document.userId, userId));

      // The durable memory profile.
      await tx.delete(userMemory).where(eq(userMemory.userId, userId));

      // Progress-tracking entries (weight log + photos).
      await tx.delete(progressEntry).where(eq(progressEntry.userId, userId));

      // Nutrition: photo analyses + the daily target.
      await tx.delete(mealAnalysis).where(eq(mealAnalysis.userId, userId));
      await tx.delete(nutritionTarget).where(eq(nutritionTarget.userId, userId));

      // Any outstanding auth-email tokens.
      await tx
        .delete(emailVerificationToken)
        .where(eq(emailVerificationToken.userId, userId));
      await tx
        .delete(passwordResetToken)
        .where(eq(passwordResetToken.userId, userId));

      // Finally the account itself.
      await tx.delete(user).where(eq(user.id, userId));
    });

    return { ok: true, email: normalized };
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete user");
  }
}

/** High-level counts for the admin dashboard's "monitor users" strip. */
export async function getUserStats(): Promise<{
  totalUsers: number;
  paidMembers: number;
}> {
  try {
    const [[totalRow], [paidRow]] = await Promise.all([
      db
        .select({ value: count() })
        .from(user)
        .where(eq(user.isAnonymous, false)),
      db
        .select({ value: count() })
        .from(user)
        .where(inArray(user.subscriptionStatus, ["active", "trialing", "past_due"])),
    ]);

    return {
      totalUsers: totalRow?.value ?? 0,
      paidMembers: paidRow?.value ?? 0,
    };
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get user stats");
  }
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  subscriptionTier: "basic" | "pro" | null;
  subscriptionStatus: string | null;
  createdAt: Date;
  chatCount: number;
  messageCount: number;
};

/**
 * The admin user directory: real (non-anonymous) members, newest first, with a
 * count of their chats and messages. An optional case-insensitive search over
 * email and name narrows the list. Capped by `limit` — this backs an admin
 * lookup screen, not a public listing.
 */
export async function getUserDirectory({
  search,
  limit = 50,
}: {
  search?: string;
  limit?: number;
}): Promise<AdminUserRow[]> {
  try {
    const trimmed = search?.trim();
    const whereCondition = trimmed
      ? and(
          eq(user.isAnonymous, false),
          or(
            ilike(user.email, `%${trimmed}%`),
            ilike(user.name, `%${trimmed}%`)
          )
        )
      : eq(user.isAnonymous, false);

    return await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
        chatCount: countDistinct(chat.id),
        messageCount: count(message.id),
      })
      .from(user)
      .leftJoin(chat, eq(chat.userId, user.id))
      .leftJoin(message, eq(message.chatId, chat.id))
      .where(whereCondition)
      .groupBy(user.id)
      .orderBy(desc(user.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user directory"
    );
  }
}

/** Activity + membership-mix stats for the admin dashboard. */
export async function getUsageStats(): Promise<{
  messagesLast24h: number;
  signups7d: number;
  trialing: number;
  basic: number;
  pro: number;
}> {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [[msgRow], [signupRow], tierRows] = await Promise.all([
      db
        .select({ value: count() })
        .from(message)
        .where(and(eq(message.role, "user"), gte(message.createdAt, since24h))),
      db
        .select({ value: count() })
        .from(user)
        .where(and(eq(user.isAnonymous, false), gte(user.createdAt, since7d))),
      db
        .select({
          tier: user.subscriptionTier,
          status: user.subscriptionStatus,
          value: count(),
        })
        .from(user)
        .where(
          inArray(user.subscriptionStatus, ["active", "trialing", "past_due"])
        )
        .groupBy(user.subscriptionTier, user.subscriptionStatus),
    ]);

    let trialing = 0;
    let basic = 0;
    let pro = 0;
    for (const row of tierRows) {
      if (row.status === "trialing") {
        trialing += row.value;
      } else if (row.tier === "pro") {
        pro += row.value;
      } else {
        basic += row.value;
      }
    }

    return {
      messagesLast24h: msgRow?.value ?? 0,
      signups7d: signupRow?.value ?? 0,
      trialing,
      basic,
      pro,
    };
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get usage stats");
  }
}

// --- Progress tracking (Pro dashboard) ---

export async function createProgressEntry(entry: {
  userId: string;
  recordedAt: Date;
  weight: number | null;
  unit: "lb" | "kg";
  photoUrl: string | null;
  note: string | null;
}): Promise<ProgressEntry> {
  try {
    const [created] = await db
      .insert(progressEntry)
      .values({
        userId: entry.userId,
        recordedAt: entry.recordedAt,
        weight: entry.weight,
        unit: entry.unit,
        photoUrl: entry.photoUrl,
        note: entry.note,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create progress entry"
    );
  }
}

/** A user's progress log, oldest first (so a weight chart reads left→right). */
export async function getProgressEntriesByUserId(
  userId: string
): Promise<ProgressEntry[]> {
  try {
    return await db
      .select()
      .from(progressEntry)
      .where(eq(progressEntry.userId, userId))
      .orderBy(asc(progressEntry.recordedAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get progress entries"
    );
  }
}

/** Delete one entry, scoped to its owner so a user can't delete another's. */
export async function deleteProgressEntry({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(progressEntry)
      .where(and(eq(progressEntry.id, id), eq(progressEntry.userId, userId)));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete progress entry"
    );
  }
}

// --- Nutrition: meal / fridge / pantry analyses (Pro) ---

export async function createMealAnalysis(entry: {
  userId: string;
  kind: "meal" | "fridge" | "pantry";
  photoUrl: string;
  title: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  healthScore: number | null;
  verdict: string;
  items: unknown;
  tips: unknown;
}): Promise<MealAnalysis> {
  try {
    const [created] = await db
      .insert(mealAnalysis)
      .values({
        userId: entry.userId,
        kind: entry.kind,
        photoUrl: entry.photoUrl,
        title: entry.title,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        healthScore: entry.healthScore,
        verdict: entry.verdict,
        items: entry.items,
        tips: entry.tips,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save meal analysis"
    );
  }
}

/** A user's analyses, newest first. Capped — this backs a scrollable feed. */
export async function getMealAnalysesByUserId(
  userId: string,
  limit = 60
): Promise<MealAnalysis[]> {
  try {
    return await db
      .select()
      .from(mealAnalysis)
      .where(eq(mealAnalysis.userId, userId))
      .orderBy(desc(mealAnalysis.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get meal analyses"
    );
  }
}

/** Meals (only) logged since `since` — used for the day's running macro totals. */
export async function getMealsSince(
  userId: string,
  since: Date
): Promise<MealAnalysis[]> {
  try {
    return await db
      .select()
      .from(mealAnalysis)
      .where(
        and(
          eq(mealAnalysis.userId, userId),
          eq(mealAnalysis.kind, "meal"),
          gte(mealAnalysis.createdAt, since)
        )
      )
      .orderBy(desc(mealAnalysis.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get today's meals");
  }
}

/** Delete one analysis, scoped to its owner. */
export async function deleteMealAnalysis({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(mealAnalysis)
      .where(and(eq(mealAnalysis.id, id), eq(mealAnalysis.userId, userId)));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete meal analysis"
    );
  }
}

export async function getNutritionTarget(
  userId: string
): Promise<NutritionTarget | undefined> {
  try {
    const [found] = await db
      .select()
      .from(nutritionTarget)
      .where(eq(nutritionTarget.userId, userId));
    return found;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get nutrition target"
    );
  }
}

export async function upsertNutritionTarget(
  userId: string,
  target: { calories: number | null; protein: number | null }
): Promise<void> {
  try {
    await db
      .insert(nutritionTarget)
      .values({
        userId,
        calories: target.calories,
        protein: target.protein,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: nutritionTarget.userId,
        set: {
          calories: target.calories,
          protein: target.protein,
          updatedAt: new Date(),
        },
      });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save nutrition target"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  try {
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt))
      .limit(1);

    const latest = docs[0];
    if (!latest) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    return await db
      .update(document)
      .set({ content })
      .where(and(eq(document.id, id), eq(document.createdAt, latest.createdAt)))
      .returning();
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update document content"
    );
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (_error) {
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}
