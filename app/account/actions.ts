"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import {
  clearUserMemory,
  deleteAllUserData,
  getUserById,
  setChadIntensity,
  setCheckInSettings,
  setExerciseCalorieAddBack,
  setMemoryEnabled,
  setQuitDateEnabled,
  setSensoryPrefs,
  setUserTimezone,
  setWeeklyReportSettings,
  setWeightUnit,
  updateUserProfile,
} from "@/lib/db/queries";
import {
  EVENING_HOUR_CHOICES,
  MORNING_HOUR_CHOICES,
  maxDaysForFrequency,
} from "@/lib/checkins/schedule";
import { isValidTimezone } from "@/lib/date";
import { type ProfileInput, profileSchema } from "@/lib/profile";
import { getAppUrl, getStripe } from "@/lib/stripe";
import {
  ensureStripeCustomer,
  isMissingStripeResource,
} from "@/lib/stripe-customer";

/**
 * Opens Stripe's hosted billing portal where the member can update their card,
 * switch plans, or cancel. Changes flow back to us via webhooks.
 */
export async function openBillingPortal() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user?.stripeCustomerId) {
    redirect("/pricing");
  }

  // Verified-or-recreated (ACC-29): a stale stored customer id would otherwise
  // make the portal call throw and dead-end the member on an error screen.
  const { customerId } = await ensureStripeCustomer(
    session.user.id,
    user.email ?? "",
    user
  );

  const portal = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl()}/account`,
  });

  redirect(portal.url);
}

/**
 * Sends a member straight into Stripe's hosted plan-change flow for their
 * existing subscription (pre-selected to the update screen). Stripe shows the
 * exact proration and handles the charge, so there's no second subscription and
 * no custom billing UI to maintain. The result syncs back via the webhook.
 * Serves both upgrade cards (Basic→Pro and Pro→Elite): the portal's update
 * screen lists every price the portal configuration allows.
 */
export async function startPlanChange() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!(user?.stripeCustomerId && user.stripeSubscriptionId)) {
    // No live subscription to upgrade — send them to choose a plan instead.
    redirect("/pricing");
  }

  // A plan change needs the EXISTING customer + subscription; if Stripe no
  // longer recognizes either (stale ids, ACC-29), there is nothing to change;
  // send them to pick a plan fresh instead of erroring.
  let portalUrl: string;
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${getAppUrl()}/account`,
      flow_data: {
        type: "subscription_update",
        subscription_update: { subscription: user.stripeSubscriptionId },
      },
    });
    portalUrl = portal.url;
  } catch (error) {
    if (isMissingStripeResource(error)) {
      redirect("/pricing");
    }
    throw error;
  }

  redirect(portalUrl);
}

/** Set the member's preferred body-weight unit (lb/kg). */
export async function setPreferredWeightUnit(unit: "lb" | "kg") {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await setWeightUnit(session.user.id, unit);
  revalidatePath("/account");
  revalidatePath("/home");
  revalidatePath("/progress");
}

/**
 * Save the member's editable stats/profile (ONB-2). This is their own trusted
 * data — the source of truth Chad reads in every chat — so they can correct
 * anything he ever got wrong. Revalidates /home because the profile's sex
 * drives the default hero figure there.
 */
export async function saveProfile(input: ProfileInput) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid profile");
  }

  await updateUserProfile(session.user.id, parsed.data);
  revalidatePath("/account");
  revalidatePath("/home");
}

/**
 * Silent first-visit timezone capture (FEAT-8). Fired once per browser session
 * by `TimezoneSync` with the browser's IANA zone; only ever fills an EMPTY
 * `User.timezone` (it never overwrites a zone the member chose or a report-
 * settings capture). Returns whether it ran against a signed-in account so the
 * client knows to retry after login instead of marking itself done.
 */
export async function captureTimezone(
  timezone: string
): Promise<{ authed: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { authed: false };
  }
  if (typeof timezone === "string" && isValidTimezone(timezone)) {
    await setUserTimezone(session.user.id, timezone, { onlyIfUnset: true });
  }
  return { authed: true };
}

/** Explicitly set the member's timezone from the /account dropdown (FEAT-8). */
export async function saveTimezone(timezone: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!(typeof timezone === "string" && isValidTimezone(timezone))) {
    throw new Error("Invalid timezone");
  }

  await setUserTimezone(session.user.id, timezone);
  revalidatePath("/account");
  revalidatePath("/home");
  revalidatePath("/nutrition");
  revalidatePath("/sleep");
}

/**
 * Save the member's proactive check-in preferences + schedule (FEAT-11 →
 * FEAT-15, Elite). Days/hours are the member's own local time; the browser's
 * IANA timezone rides along silently like the weekly-report save so the
 * hourly cron hits the right local moment.
 */
export async function saveCheckInSettings(input: {
  enabled: boolean;
  frequency: "daily" | "three_per_week" | "weekly";
  days: number[];
  morningHour: number;
  eveningHour: number;
  timezone?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const validDays =
    Array.isArray(input.days) &&
    input.days.length >= 1 &&
    input.days.length <= maxDaysForFrequency(input.frequency) &&
    input.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    new Set(input.days).size === input.days.length;

  if (
    typeof input.enabled !== "boolean" ||
    !["daily", "three_per_week", "weekly"].includes(input.frequency) ||
    !validDays ||
    !MORNING_HOUR_CHOICES.includes(input.morningHour) ||
    !EVENING_HOUR_CHOICES.includes(input.eveningHour)
  ) {
    throw new Error("Invalid check-in settings");
  }

  const timezone =
    typeof input.timezone === "string" && isValidTimezone(input.timezone)
      ? input.timezone
      : undefined;

  await setCheckInSettings(session.user.id, {
    checkInsEnabled: input.enabled,
    checkInFrequency: input.frequency,
    checkInDays: [...input.days].sort((a, b) => a - b),
    checkInMorningHour: input.morningHour,
    checkInEveningHour: input.eveningHour,
    ...(timezone ? { timezone } : {}),
  });
  revalidatePath("/account");
}

/**
 * Save the member's weekly-report schedule (FEAT-12, Elite). The browser's
 * IANA timezone rides along silently so the hourly cron can hit their chosen
 * local day + hour; a missing/garbled zone just leaves the stored one alone.
 */
export async function saveWeeklyReportSettings(input: {
  enabled: boolean;
  day: number;
  hour: number;
  timezone?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (
    typeof input.enabled !== "boolean" ||
    !Number.isInteger(input.day) ||
    input.day < 0 ||
    input.day > 6 ||
    !Number.isInteger(input.hour) ||
    input.hour < 0 ||
    input.hour > 23
  ) {
    throw new Error("Invalid weekly-report settings");
  }

  const timezone =
    typeof input.timezone === "string" && isValidTimezone(input.timezone)
      ? input.timezone
      : undefined;

  await setWeeklyReportSettings(session.user.id, {
    weeklyReportsEnabled: input.enabled,
    weeklyReportDay: input.day,
    weeklyReportHour: input.hour,
    ...(timezone ? { timezone } : {}),
  });
  revalidatePath("/account");
  revalidatePath("/reports");
}

/** Flip the logging sound / vibration feedback preferences (DSH-54). */
export async function saveSensorySettings(prefs: {
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const fields: { soundEnabled?: boolean; hapticsEnabled?: boolean } = {};
  if (typeof prefs.soundEnabled === "boolean") {
    fields.soundEnabled = prefs.soundEnabled;
  }
  if (typeof prefs.hapticsEnabled === "boolean") {
    fields.hapticsEnabled = prefs.hapticsEnabled;
  }
  if (Object.keys(fields).length === 0) {
    return;
  }

  await setSensoryPrefs(session.user.id, fields);
  revalidatePath("/account");
}

/**
 * Switch the Quit Date mechanic on or off (FEAT-25). Off hides the /home
 * card, blocks new autopsies, and drops the prediction from Chad's chat and
 * check-in prompts + the cron sweeps. The prediction ledger itself is kept.
 */
export async function saveQuitDateEnabled(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (typeof enabled !== "boolean") {
    throw new Error("Invalid Quit Date setting");
  }

  await setQuitDateEnabled(session.user.id, enabled);
  revalidatePath("/account");
  revalidatePath("/home");
  revalidatePath("/quit-date");
}

/**
 * The D2 exercise-calorie toggle (calories-burned Phase 3): whether logged
 * exercise raises the day's calorie budget (Remaining = Target − Food +
 * Exercise). Off = plain Target − Food everywhere, instantly.
 */
export async function saveExerciseCalorieAddBack(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (typeof enabled !== "boolean") {
    throw new Error("Invalid exercise calories setting");
  }

  await setExerciseCalorieAddBack(session.user.id, enabled);
  revalidatePath("/account");
  revalidatePath("/home");
  revalidatePath("/nutrition");
}

/** Set how hard Chad goes on the current member (full | medium | low). */
export async function saveChadIntensity(intensity: "full" | "medium" | "low") {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!["full", "medium", "low"].includes(intensity)) {
    throw new Error("Invalid intensity setting");
  }

  await setChadIntensity(session.user.id, intensity);
  revalidatePath("/account");
}

/** Turn Chad's cross-chat memory on or off for the current user. */
export async function setChadMemoryEnabled(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await setMemoryEnabled(session.user.id, enabled);
  revalidatePath("/account");
}

/** Wipe everything Chad remembers about the current user. */
export async function clearChadMemory() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await clearUserMemory(session.user.id);
  revalidatePath("/account");
}

/**
 * Delete ALL of the member's data — chats, logs, photos, memory, reports,
 * predictions — keeping only the account itself (login + subscription), so
 * they can start clean or leave nothing behind. Irreversible; the UI
 * double-confirms before calling this.
 */
export async function deleteMyData() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await deleteAllUserData(session.user.id);
  revalidatePath("/account");
  revalidatePath("/home");
}
