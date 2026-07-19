import { tool } from "ai";
import type { Session } from "next-auth";
import { canAccessProFeatures } from "@/lib/admin";
import { logCardioInputSchema } from "@/lib/ai/tool-schemas";
import { parseCalendarDay } from "@/lib/date";
import { createWorkout, getLatestWeighIn } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { findActivity } from "@/lib/energy/activity-catalog";
import { cardioNetKcal } from "@/lib/energy/workout-energy";
import { weighInKg } from "@/lib/progress/weight";
import {
  buildCardioWorkout,
  resolveCardioVariant,
} from "@/lib/workouts/cardio-entry";

type LogCardioProps = {
  session: Session;
  user: User;
};

/**
 * Lets Chad log a cardio session the client reports in chat (Phase 4).
 * Writes through buildCardioWorkout — the exact builder the /workouts/cardio
 * page uses — so a chat-logged session is row-for-row identical to one
 * logged on the page: one workout, one timed cardio exercise carrying the
 * "activity · effort" name snapshot, one completed set holding the seconds.
 * The burn estimate is recomputed at read time (plan §6); the number
 * returned here is only the confirmation for Chad to say back. Pro-gated
 * like the page.
 */
export const logCardio = ({ session, user }: LogCardioProps) =>
  tool({
    description:
      "Log a cardio session the client reports (a run, ride, row, swim, sport, or class) into their workout history. Its estimated calories count toward that day's calorie budget. Use it when they tell you cardio they actually did and roughly how many minutes it took; pick the closest catalog activity. For a strength session with sets and reps, use logWorkout instead. Never log cardio they didn't report.",
    inputSchema: logCardioInputSchema,
    execute: async ({ activity: activityId, minutes, intensity, recordedAt }) => {
      if (!canAccessProFeatures(user)) {
        return {
          error:
            "This client's plan doesn't include workout tracking; it's part of Chad Pro. Tell them to upgrade to have you track their training. Give them the upgrade link: [Upgrade to Pro](/pricing).",
        };
      }

      const activity = findActivity(activityId);
      if (!activity) {
        return { error: "Unknown activity. Pick one from the catalog list." };
      }

      const variant = resolveCardioVariant(activity, intensity);
      if (variant === null) {
        const options = activity.variants?.map((v) => v.id).join(", ");
        return {
          error: options
            ? `"${intensity}" isn't an effort level for ${activity.label}. Valid choices: ${options}. Retry with one of those, or omit intensity for the standard effort.`
            : `${activity.label} has no effort levels; retry without intensity.`,
        };
      }

      const write = buildCardioWorkout({
        activityId,
        variantId: variant?.id,
        minutes,
        performedAt: parseCalendarDay(recordedAt ?? undefined) ?? new Date(),
        weightUnit: user.weightUnit === "kg" ? "kg" : "lb",
      });
      if (!write) {
        return { error: "Unknown activity. Pick one from the catalog list." };
      }

      const created = await createWorkout({ userId: session.user.id, ...write });

      const latest = await getLatestWeighIn(session.user.id);
      const estimatedKcal = cardioNetKcal({
        activityId,
        variantId: variant?.id,
        minutes,
        weightKg: weighInKg(latest),
      });

      const what = `${write.exercises[0].name}, ${minutes} min`;
      return {
        id: created.id,
        title: created.title,
        estimatedKcal,
        message:
          estimatedKcal != null
            ? `Cardio logged (${what}) — about ${estimatedKcal} cal estimated, counted toward the day's calorie budget. Tell the client exactly what went in.`
            : `Cardio logged (${what}). No calorie estimate yet because they have no weigh-in on record — the estimate needs their body weight, so have them log a weigh-in.`,
      };
    },
  });
