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
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { ChatbotError } from "../errors";
import { generateUUID } from "../utils";
import {
  type BodyMeasurement,
  bodyMeasurement,
  type Chat,
  type CustomExercise,
  chat,
  customExercise,
  type DBMessage,
  document,
  emailVerificationToken,
  type Goal,
  goal,
  type MealAnalysis,
  mealAnalysis,
  message,
  type NutritionTarget,
  nutritionTarget,
  type Plan,
  type ProgressEntry,
  passwordResetToken,
  plan,
  progressEntry,
  type Suggestion,
  stream,
  suggestion,
  type User,
  type UserMemory,
  user,
  userMemory,
  vote,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  waterLog,
  workout,
  workoutExercise,
  workoutSet,
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

/**
 * Find-or-create the local User row for a Google sign-in. There is no NextAuth
 * DB adapter, so account linking is done here by email: a Google login lands on
 * the existing email/password account when one exists (Google has verified the
 * address, so this is safe), otherwise a fresh password-less row is created.
 * Either way the email is marked verified and name/image are backfilled.
 */
export async function getOrCreateGoogleUser({
  email,
  name,
  image,
}: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<User> {
  try {
    const [existing] = await db
      .select()
      .from(user)
      .where(eq(user.email, email));

    if (existing) {
      const patch: Partial<User> = {};
      if (!existing.emailVerified) {
        patch.emailVerified = true;
      }
      if (!existing.name && name) {
        patch.name = name;
      }
      if (!existing.image && image) {
        patch.image = image;
      }
      if (Object.keys(patch).length === 0) {
        return existing;
      }
      const [updated] = await db
        .update(user)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(user.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(user)
      .values({
        email,
        name: name ?? null,
        image: image ?? null,
        emailVerified: true,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get or create Google user"
    );
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
    throw new ChatbotError("bad_request:database", "Failed to update password");
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
    return await db.delete(userMemory).where(eq(userMemory.userId, userId));
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

/**
 * Sync a user's subscription columns from a Stripe webhook, keyed by customer
 * id. Returns the number of rows updated so the caller can fall back to
 * matching by user id when the customer id isn't on any row yet (the
 * checkout↔webhook race).
 */
export async function updateUserSubscriptionByCustomerId(
  stripeCustomerId: string,
  data: SubscriptionUpdate
): Promise<number> {
  try {
    const result = await db
      .update(user)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(user.stripeCustomerId, stripeCustomerId));
    return result.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update subscription"
    );
  }
}

/**
 * Fallback sync keyed by our own user id (from `subscription.metadata.userId`,
 * stamped at checkout). Used when a `subscription.*` webhook arrives before the
 * customer id is persisted on the user row. Also backfills the customer id so
 * later webhooks match the fast path. Returns rows updated.
 */
export async function updateUserSubscriptionById(
  userId: string,
  data: SubscriptionUpdate & { stripeCustomerId: string }
): Promise<number> {
  try {
    const result = await db
      .update(user)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(user.id, userId));
    return result.count ?? 0;
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

      // Nutrition: photo analyses + the daily target + water log.
      await tx.delete(mealAnalysis).where(eq(mealAnalysis.userId, userId));
      await tx
        .delete(nutritionTarget)
        .where(eq(nutritionTarget.userId, userId));
      await tx.delete(waterLog).where(eq(waterLog.userId, userId));

      // Goals, plans, and body measurements.
      await tx.delete(goal).where(eq(goal.userId, userId));
      await tx.delete(plan).where(eq(plan.userId, userId));
      await tx
        .delete(bodyMeasurement)
        .where(eq(bodyMeasurement.userId, userId));

      // Workout logs: sets → exercises → workouts, plus custom exercises.
      await tx.delete(workoutSet).where(eq(workoutSet.userId, userId));
      await tx
        .delete(workoutExercise)
        .where(eq(workoutExercise.userId, userId));
      await tx.delete(workout).where(eq(workout.userId, userId));
      await tx.delete(customExercise).where(eq(customExercise.userId, userId));

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
        .where(
          inArray(user.subscriptionStatus, ["active", "trialing", "past_due"])
        ),
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

/** Edit one entry (weight/unit/date/note), scoped to its owner. */
export async function updateProgressEntry(entry: {
  id: string;
  userId: string;
  recordedAt: Date;
  weight: number | null;
  unit: "lb" | "kg";
  note: string | null;
}): Promise<void> {
  try {
    await db
      .update(progressEntry)
      .set({
        recordedAt: entry.recordedAt,
        weight: entry.weight,
        unit: entry.unit,
        note: entry.note,
      })
      .where(
        and(
          eq(progressEntry.id, entry.id),
          eq(progressEntry.userId, entry.userId)
        )
      );
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update progress entry"
    );
  }
}

// --- Body measurements (waist/chest/arms/… over time) ---

export async function createBodyMeasurement(entry: {
  userId: string;
  recordedAt: Date;
  kind: BodyMeasurement["kind"];
  value: number;
  unit: "in" | "cm";
}): Promise<BodyMeasurement> {
  try {
    const [created] = await db
      .insert(bodyMeasurement)
      .values({
        userId: entry.userId,
        recordedAt: entry.recordedAt,
        kind: entry.kind,
        value: entry.value,
        unit: entry.unit,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save measurement"
    );
  }
}

/** A user's measurements, oldest first (so per-metric trends read left→right). */
export async function getBodyMeasurementsByUserId(
  userId: string
): Promise<BodyMeasurement[]> {
  try {
    return await db
      .select()
      .from(bodyMeasurement)
      .where(eq(bodyMeasurement.userId, userId))
      .orderBy(asc(bodyMeasurement.recordedAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get measurements"
    );
  }
}

/** Delete one measurement, scoped to its owner. */
export async function deleteBodyMeasurement({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(bodyMeasurement)
      .where(
        and(eq(bodyMeasurement.id, id), eq(bodyMeasurement.userId, userId))
      );
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete measurement"
    );
  }
}

// --- Goals & Plans (structured, multiple, Chad-aware) ---

export async function createGoal(entry: {
  userId: string;
  title: string;
  detail: string;
  targetDate: string | null;
  status: Goal["status"];
  source: Goal["source"];
  sourceChatId: string | null;
  metric: Goal["metric"];
  startValue: number | null;
  targetValue: number | null;
  unit: string | null;
}): Promise<Goal> {
  try {
    const [created] = await db.insert(goal).values(entry).returning();
    return created;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create goal");
  }
}

/** A user's goals, newest first. */
export async function getGoalsByUserId(userId: string): Promise<Goal[]> {
  try {
    return await db
      .select()
      .from(goal)
      .where(eq(goal.userId, userId))
      .orderBy(desc(goal.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get goals");
  }
}

/** A user's active goals only — what Chad sees and the dashboard leads with. */
export async function getActiveGoalsByUserId(userId: string): Promise<Goal[]> {
  try {
    return await db
      .select()
      .from(goal)
      .where(and(eq(goal.userId, userId), eq(goal.status, "active")))
      .orderBy(desc(goal.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get goals");
  }
}

/** Edit one goal, scoped to its owner. */
export async function updateGoal(entry: {
  id: string;
  userId: string;
  title: string;
  detail: string;
  targetDate: string | null;
  status: Goal["status"];
  metric: Goal["metric"];
  startValue: number | null;
  targetValue: number | null;
  unit: string | null;
}): Promise<void> {
  try {
    const { id, userId, ...fields } = entry;
    await db
      .update(goal)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(goal.id, id), eq(goal.userId, userId)));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update goal");
  }
}

/** Delete one goal, scoped to its owner. */
export async function deleteGoal({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db.delete(goal).where(and(eq(goal.id, id), eq(goal.userId, userId)));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete goal");
  }
}

export async function createPlan(entry: {
  userId: string;
  title: string;
  detail: string;
  kind: Plan["kind"];
  status: Plan["status"];
  source: Plan["source"];
  sourceChatId: string | null;
}): Promise<Plan> {
  try {
    const [created] = await db.insert(plan).values(entry).returning();
    return created;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create plan");
  }
}

/** A user's plans, newest first. */
export async function getPlansByUserId(userId: string): Promise<Plan[]> {
  try {
    return await db
      .select()
      .from(plan)
      .where(eq(plan.userId, userId))
      .orderBy(desc(plan.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get plans");
  }
}

/** A user's active plans only — what Chad sees and the dashboard leads with. */
export async function getActivePlansByUserId(userId: string): Promise<Plan[]> {
  try {
    return await db
      .select()
      .from(plan)
      .where(and(eq(plan.userId, userId), eq(plan.status, "active")))
      .orderBy(desc(plan.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get plans");
  }
}

/** Edit one plan, scoped to its owner. */
export async function updatePlan(entry: {
  id: string;
  userId: string;
  title: string;
  detail: string;
  kind: Plan["kind"];
  status: Plan["status"];
}): Promise<void> {
  try {
    const { id, userId, ...fields } = entry;
    await db
      .update(plan)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(plan.id, id), eq(plan.userId, userId)));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update plan");
  }
}

/** Delete one plan, scoped to its owner. */
export async function deletePlan({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db.delete(plan).where(and(eq(plan.id, id), eq(plan.userId, userId)));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete plan");
  }
}

// --- Nutrition: meal / fridge / pantry analyses (Pro) ---

type MealCategoryValue = "breakfast" | "lunch" | "dinner" | "snack";

export async function createMealAnalysis(entry: {
  userId: string;
  kind: "meal" | "fridge" | "pantry";
  source?: "photo" | "manual";
  meal?: MealCategoryValue | null;
  recordedAt?: Date | null;
  photoUrl: string | null;
  title: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  healthScore: number | null;
  verdict: string | null;
  items: unknown;
  tips: unknown;
}): Promise<MealAnalysis> {
  try {
    const [created] = await db
      .insert(mealAnalysis)
      .values({
        userId: entry.userId,
        kind: entry.kind,
        source: entry.source ?? "photo",
        meal: entry.meal ?? null,
        recordedAt: entry.recordedAt ?? new Date(),
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

/** Correct a logged meal's title/category/macros (manual edit). Scoped to owner. */
export async function updateMealAnalysis(entry: {
  id: string;
  userId: string;
  title: string;
  meal: MealCategoryValue | null;
  recordedAt?: Date | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}): Promise<void> {
  try {
    await db
      .update(mealAnalysis)
      .set({
        title: entry.title,
        meal: entry.meal,
        ...(entry.recordedAt ? { recordedAt: entry.recordedAt } : {}),
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      })
      .where(
        and(
          eq(mealAnalysis.id, entry.id),
          eq(mealAnalysis.userId, entry.userId)
        )
      );
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update meal analysis"
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
          // Effective day = recordedAt ?? createdAt. Expressed via typed columns
          // (not `coalesce(...) >= since`) so drizzle maps the Date param: a raw
          // coalesce() operand has no column type, so postgres-js receives an
          // unmapped Date and throws on serialization. Logically identical to
          // `coalesce(recordedAt, createdAt) >= since`.
          or(
            and(
              isNotNull(mealAnalysis.recordedAt),
              gte(mealAnalysis.recordedAt, since)
            ),
            and(
              isNull(mealAnalysis.recordedAt),
              gte(mealAnalysis.createdAt, since)
            )
          )
        )
      )
      .orderBy(desc(mealAnalysis.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get today's meals"
    );
  }
}

/**
 * Meals (only) logged for a day/range — the half-open [start, end) window of
 * effective days. Same `recordedAt ?? createdAt` convention as `getMealsSince`
 * (expressed via typed columns so postgres-js maps the Date params), just with
 * an upper bound too. Backs Chad's dashboard lookups for a specific past date.
 */
export async function getMealsBetween(
  userId: string,
  start: Date,
  end: Date
): Promise<MealAnalysis[]> {
  try {
    return await db
      .select()
      .from(mealAnalysis)
      .where(
        and(
          eq(mealAnalysis.userId, userId),
          eq(mealAnalysis.kind, "meal"),
          or(
            and(
              isNotNull(mealAnalysis.recordedAt),
              gte(mealAnalysis.recordedAt, start),
              lt(mealAnalysis.recordedAt, end)
            ),
            and(
              isNull(mealAnalysis.recordedAt),
              gte(mealAnalysis.createdAt, start),
              lt(mealAnalysis.createdAt, end)
            )
          )
        )
      )
      .orderBy(desc(mealAnalysis.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get meals for range"
    );
  }
}

/** A user's logged MEALS only (no fridge/pantry), newest first — backs the diary. */
export async function getMealLogByUserId(
  userId: string,
  limit = 120
): Promise<MealAnalysis[]> {
  try {
    return await db
      .select()
      .from(mealAnalysis)
      .where(
        and(eq(mealAnalysis.userId, userId), eq(mealAnalysis.kind, "meal"))
      )
      .orderBy(
        desc(
          sql`coalesce(${mealAnalysis.recordedAt}, ${mealAnalysis.createdAt})`
        ),
        desc(mealAnalysis.createdAt)
      )
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get meal log");
  }
}

/** A user's fridge/pantry analyses, newest first — backs "Rate My Kitchen". */
export async function getKitchenAnalysesByUserId(
  userId: string,
  limit = 60
): Promise<MealAnalysis[]> {
  try {
    return await db
      .select()
      .from(mealAnalysis)
      .where(
        and(
          eq(mealAnalysis.userId, userId),
          inArray(mealAnalysis.kind, ["fridge", "pantry"])
        )
      )
      .orderBy(desc(mealAnalysis.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get kitchen analyses"
    );
  }
}

/**
 * Fridge/pantry analyses within a half-open [start, end) window. Kitchen shots
 * aren't back-dated (recordedAt is null for them), so the day is `createdAt`.
 * Backs Chad's dashboard lookups so he can see what was in the kitchen on a day.
 */
export async function getKitchenAnalysesBetween(
  userId: string,
  start: Date,
  end: Date
): Promise<MealAnalysis[]> {
  try {
    return await db
      .select()
      .from(mealAnalysis)
      .where(
        and(
          eq(mealAnalysis.userId, userId),
          inArray(mealAnalysis.kind, ["fridge", "pantry"]),
          gte(mealAnalysis.createdAt, start),
          lt(mealAnalysis.createdAt, end)
        )
      )
      .orderBy(desc(mealAnalysis.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get kitchen analyses"
    );
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
  target: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  }
): Promise<void> {
  try {
    await db
      .insert(nutritionTarget)
      .values({
        userId,
        calories: target.calories,
        protein: target.protein,
        carbs: target.carbs,
        fat: target.fat,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: nutritionTarget.userId,
        set: {
          calories: target.calories,
          protein: target.protein,
          carbs: target.carbs,
          fat: target.fat,
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

// --- Water log (lightweight daily counter on /today) ---

/** Total ml logged since `since` (clamped at 0). */
export async function getWaterMlSince(
  userId: string,
  since: Date
): Promise<number> {
  try {
    const rows = await db
      .select({ amountMl: waterLog.amountMl })
      .from(waterLog)
      .where(and(eq(waterLog.userId, userId), gte(waterLog.recordedAt, since)));
    return Math.max(
      0,
      rows.reduce((sum, r) => sum + (r.amountMl ?? 0), 0)
    );
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get water total");
  }
}

/** Total ml logged within a half-open [start, end) window (clamped at 0). */
export async function getWaterMlBetween(
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  try {
    const rows = await db
      .select({ amountMl: waterLog.amountMl })
      .from(waterLog)
      .where(
        and(
          eq(waterLog.userId, userId),
          gte(waterLog.recordedAt, start),
          lt(waterLog.recordedAt, end)
        )
      );
    return Math.max(
      0,
      rows.reduce((sum, r) => sum + (r.amountMl ?? 0), 0)
    );
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get water total");
  }
}

/**
 * Daily water totals over the last `sinceDays` days, oldest first, for the
 * hydration trend chart. Each row is one UTC calendar day's summed ml (keyed to
 * that day's midnight-UTC ms) — bucketed in JS the same way `volumeTrend` does,
 * so ticks/tooltips stay timezone-stable (see `lib/date.ts`).
 */
export async function getWaterDailyTotals(
  userId: string,
  sinceDays = 90
): Promise<{ t: number; ml: number }[]> {
  try {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        recordedAt: waterLog.recordedAt,
        amountMl: waterLog.amountMl,
      })
      .from(waterLog)
      .where(
        and(eq(waterLog.userId, userId), gte(waterLog.recordedAt, since))
      );
    const byDay = new Map<number, number>();
    for (const r of rows) {
      const d = r.recordedAt;
      const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      byDay.set(t, (byDay.get(t) ?? 0) + (r.amountMl ?? 0));
    }
    return [...byDay.entries()]
      .map(([t, ml]) => ({ t, ml: Math.max(0, ml) }))
      .sort((a, b) => a.t - b.t);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get water history"
    );
  }
}

export async function addWaterLog(entry: {
  userId: string;
  amountMl: number;
}): Promise<void> {
  try {
    await db.insert(waterLog).values({
      userId: entry.userId,
      amountMl: entry.amountMl,
      recordedAt: new Date(),
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to log water");
  }
}

/** Remove the most recent water increment logged today (the undo for "−"). */
export async function deleteLatestWaterLog({
  userId,
  since,
}: {
  userId: string;
  since: Date;
}): Promise<void> {
  try {
    const [latest] = await db
      .select({ id: waterLog.id })
      .from(waterLog)
      .where(and(eq(waterLog.userId, userId), gte(waterLog.recordedAt, since)))
      .orderBy(desc(waterLog.recordedAt))
      .limit(1);
    if (latest) {
      await db.delete(waterLog).where(eq(waterLog.id, latest.id));
    }
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update water");
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

// --- Workout logging -------------------------------------------------------

export type WorkoutWithChildren = Workout & {
  exercises: (WorkoutExercise & { sets: WorkoutSet[] })[];
};

type WorkoutWriteInput = {
  userId: string;
  title: string;
  performedAt: Date;
  durationSeconds: number | null;
  notes: string | null;
  exercises: {
    name: string;
    muscleGroup: string | null;
    notes: string | null;
    sets: {
      weight: number | null;
      reps: number | null;
      unit: WorkoutSet["unit"];
      rpe: number | null;
      setType: WorkoutSet["setType"];
      completed: boolean;
    }[];
  }[];
};

/** Insert the workout's child exercises + sets inside an open transaction. */
async function insertWorkoutChildren(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  workoutId: string,
  input: WorkoutWriteInput
): Promise<void> {
  for (const [exIndex, ex] of input.exercises.entries()) {
    const [createdEx] = await tx
      .insert(workoutExercise)
      .values({
        workoutId,
        userId: input.userId,
        exerciseName: ex.name,
        muscleGroup: ex.muscleGroup,
        position: exIndex,
        notes: ex.notes,
      })
      .returning();
    if (ex.sets.length > 0) {
      await tx.insert(workoutSet).values(
        ex.sets.map((s, setIndex) => ({
          workoutExerciseId: createdEx.id,
          userId: input.userId,
          position: setIndex,
          weight: s.weight,
          unit: s.unit,
          reps: s.reps,
          rpe: s.rpe,
          setType: s.setType,
          completed: s.completed,
        }))
      );
    }
  }
}

export async function createWorkout(
  input: WorkoutWriteInput
): Promise<Workout> {
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(workout)
        .values({
          userId: input.userId,
          title: input.title,
          performedAt: input.performedAt,
          durationSeconds: input.durationSeconds,
          notes: input.notes,
        })
        .returning();
      await insertWorkoutChildren(tx, created.id, input);
      return created;
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create workout");
  }
}

/**
 * Attach each workout's exercises + sets (ordered by position) to the given
 * workout rows. Shared by every getter that returns hydrated workouts so the
 * two-extra-query join lives in exactly one place.
 */
async function hydrateWorkouts(
  workouts: Workout[]
): Promise<WorkoutWithChildren[]> {
  if (workouts.length === 0) {
    return [];
  }

  const workoutIds = workouts.map((w) => w.id);
  const exercises = await db
    .select()
    .from(workoutExercise)
    .where(inArray(workoutExercise.workoutId, workoutIds))
    .orderBy(asc(workoutExercise.position));

  const exerciseIds = exercises.map((e) => e.id);
  const sets =
    exerciseIds.length > 0
      ? await db
          .select()
          .from(workoutSet)
          .where(inArray(workoutSet.workoutExerciseId, exerciseIds))
          .orderBy(asc(workoutSet.position))
      : [];

  const setsByExercise = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const list = setsByExercise.get(s.workoutExerciseId) ?? [];
    list.push(s);
    setsByExercise.set(s.workoutExerciseId, list);
  }
  const exercisesByWorkout = new Map<
    string,
    (WorkoutExercise & { sets: WorkoutSet[] })[]
  >();
  for (const e of exercises) {
    const list = exercisesByWorkout.get(e.workoutId) ?? [];
    list.push({ ...e, sets: setsByExercise.get(e.id) ?? [] });
    exercisesByWorkout.set(e.workoutId, list);
  }

  return workouts.map((w) => ({
    ...w,
    exercises: exercisesByWorkout.get(w.id) ?? [],
  }));
}

/** All of a user's workouts (newest first) with their exercises + sets nested. */
export async function getWorkoutsByUserId(
  userId: string,
  limit?: number
): Promise<WorkoutWithChildren[]> {
  try {
    const base = db
      .select()
      .from(workout)
      .where(eq(workout.userId, userId))
      .orderBy(desc(workout.performedAt));
    const workouts = limit ? await base.limit(limit) : await base;
    return await hydrateWorkouts(workouts);
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get workouts");
  }
}

/**
 * A user's workouts trained within a half-open [start, end) window (newest
 * first), hydrated with exercises + sets. Backs Chad's day/range dashboard
 * lookups so he can see what was actually trained on a given date.
 */
export async function getWorkoutsBetween(
  userId: string,
  start: Date,
  end: Date
): Promise<WorkoutWithChildren[]> {
  try {
    const workouts = await db
      .select()
      .from(workout)
      .where(
        and(
          eq(workout.userId, userId),
          gte(workout.performedAt, start),
          lt(workout.performedAt, end)
        )
      )
      .orderBy(desc(workout.performedAt));
    return await hydrateWorkouts(workouts);
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get workouts");
  }
}

/** Replace a workout's fields + children wholesale, scoped to its owner. */
export async function updateWorkout(
  input: WorkoutWriteInput & { id: string }
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: workout.id })
        .from(workout)
        .where(and(eq(workout.id, input.id), eq(workout.userId, input.userId)));
      if (!owned) {
        return;
      }

      const existing = await tx
        .select({ id: workoutExercise.id })
        .from(workoutExercise)
        .where(eq(workoutExercise.workoutId, input.id));
      const existingIds = existing.map((e) => e.id);
      if (existingIds.length > 0) {
        await tx
          .delete(workoutSet)
          .where(inArray(workoutSet.workoutExerciseId, existingIds));
      }
      await tx
        .delete(workoutExercise)
        .where(eq(workoutExercise.workoutId, input.id));

      await tx
        .update(workout)
        .set({
          title: input.title,
          performedAt: input.performedAt,
          durationSeconds: input.durationSeconds,
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(and(eq(workout.id, input.id), eq(workout.userId, input.userId)));

      await insertWorkoutChildren(tx, input.id, input);
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update workout");
  }
}

export async function deleteWorkout({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: workout.id })
        .from(workout)
        .where(and(eq(workout.id, id), eq(workout.userId, userId)));
      if (!owned) {
        return;
      }
      const existing = await tx
        .select({ id: workoutExercise.id })
        .from(workoutExercise)
        .where(eq(workoutExercise.workoutId, id));
      const existingIds = existing.map((e) => e.id);
      if (existingIds.length > 0) {
        await tx
          .delete(workoutSet)
          .where(inArray(workoutSet.workoutExerciseId, existingIds));
      }
      await tx.delete(workoutExercise).where(eq(workoutExercise.workoutId, id));
      await tx
        .delete(workout)
        .where(and(eq(workout.id, id), eq(workout.userId, userId)));
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete workout");
  }
}

export async function getCustomExercisesByUserId(
  userId: string
): Promise<CustomExercise[]> {
  try {
    return await db
      .select()
      .from(customExercise)
      .where(eq(customExercise.userId, userId))
      .orderBy(asc(customExercise.name));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get custom exercises"
    );
  }
}

export async function createCustomExercise(entry: {
  userId: string;
  name: string;
  muscleGroup: CustomExercise["muscleGroup"];
  equipment: CustomExercise["equipment"];
}): Promise<CustomExercise> {
  try {
    const [created] = await db.insert(customExercise).values(entry).returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create custom exercise"
    );
  }
}

export async function deleteCustomExercise({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(customExercise)
      .where(and(eq(customExercise.id, id), eq(customExercise.userId, userId)));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete custom exercise"
    );
  }
}
