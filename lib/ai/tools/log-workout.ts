import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { canAccessProFeatures } from "@/lib/admin";
import { parseDateInput } from "@/lib/date";
import { createWorkout } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";

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
      "Log a workout the client reports into their dashboard so it's tracked and counts toward their PRs and volume. Use this when the client tells you a session they actually did (e.g. 'I benched 3x8 at 135'). Record each exercise with its working sets. Don't invent sets they didn't report.",
    inputSchema: z.object({
      title: z
        .string()
        .max(120)
        .describe("Session label, e.g. 'Push Day' or 'Legs'."),
      performedAt: z
        .string()
        .nullable()
        .optional()
        .describe("ISO date the session was done. Omit for today."),
      notes: z.string().max(2000).nullable().optional(),
      exercises: z
        .array(
          z.object({
            name: z
              .string()
              .max(120)
              .describe("Exercise name, e.g. 'Barbell Bench Press'."),
            sets: z
              .array(
                z.object({
                  weight: z
                    .number()
                    .nullable()
                    .optional()
                    .describe("Load. Null for bodyweight."),
                  reps: z.number().int().nullable().optional(),
                  unit: z.enum(["lb", "kg"]).default("lb"),
                  rpe: z.number().min(1).max(10).nullable().optional(),
                })
              )
              .max(40),
          })
        )
        .min(1)
        .max(50),
    }),
    execute: async ({ title, performedAt, notes, exercises }) => {
      if (!canAccessProFeatures(user)) {
        return {
          error:
            "This client's plan doesn't include workout tracking; it's part of Chad Pro. Tell them to upgrade to have you track their training.",
        };
      }

      const performed = parseDateInput(performedAt);

      const created = await createWorkout({
        userId: session.user.id,
        title: title.trim() || "Workout",
        performedAt: performed,
        durationSeconds: null,
        notes: notes?.trim() ? notes.trim() : null,
        exercises: exercises.map((ex) => ({
          name: ex.name.trim(),
          muscleGroup: null,
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
