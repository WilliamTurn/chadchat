import { tool } from "ai";
import type { Session } from "next-auth";
import { canAccessProFeatures } from "@/lib/admin";
import { logWorkoutInputSchema } from "@/lib/ai/tool-schemas";
import { parseDateInput } from "@/lib/date";
import { createWorkout } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { findBuiltInExercise } from "@/lib/workouts/exercise-library";

type LogWorkoutProps = {
  session: Session;
  user: User;
};

/**
 * Lets Chad log a workout the client tells him about straight into their
 * dashboard, so the executed sets/reps/weight are tracked (and feed PRs/volume)
 * instead of getting buried in chat. Mirrors the save-goal factory. Pro-gated
 * like the /workouts logger itself (FEAT-14 aligned every write tool on the
 * same gate its page uses).
 */
export const logWorkout = ({ session, user }: LogWorkoutProps) =>
  tool({
    description:
      "Log a workout the client reports into their dashboard so it's tracked and counts toward their PRs and volume. Use this when the client tells you a session they actually did (e.g. 'I benched 3x8 at 135'). Record each exercise with its working sets, and the session length in minutes when they mention it (that powers the estimated exercise calories). Don't invent sets or a duration they didn't report.",
    inputSchema: logWorkoutInputSchema,
    execute: async ({
      title,
      performedAt,
      durationMinutes,
      notes,
      exercises,
    }) => {
      if (!canAccessProFeatures(user)) {
        return {
          error:
            "This client's plan doesn't include workout tracking; it's part of Chad Pro. Tell them to upgrade to have you track their training. Give them the upgrade link: [Upgrade to Pro](/pricing).",
        };
      }

      const performed = parseDateInput(performedAt);

      const created = await createWorkout({
        userId: session.user.id,
        title: title.trim() || "Workout",
        performedAt: performed,
        // The reported session length feeds the strength burn estimate
        // (sessionNetKcal prices durationSeconds at the D5 general MET).
        durationSeconds: durationMinutes != null ? durationMinutes * 60 : null,
        notes: notes?.trim() ? notes.trim() : null,
        exercises: exercises.map((ex) => ({
          name: ex.name.trim(),
          muscleGroup: null,
          // Logging kind comes from the library when the name matches; a
          // chat-reported exercise we don't know defaults to weighted.
          kind: findBuiltInExercise(ex.name)?.kind ?? null,
          supersetGroup: null,
          notes: null,
          sets: ex.sets.map((s) => ({
            weight: s.weight ?? null,
            reps: s.reps ?? null,
            unit: s.unit ?? "lb",
            rpe: s.rpe ?? null,
            setType: "working" as const,
            completed: true,
          })),
        })),
      });

      return {
        id: created.id,
        title: created.title,
        message: `Workout "${created.title}" logged to the client's dashboard.`,
      };
    },
  });
