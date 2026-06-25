import { z } from "zod";

/**
 * A single progress log entry. An entry is valid as long as it carries at least
 * one of: a weight, a photo, or a note — so the dashboard never stores empty
 * rows. Weight is bounded to a sane human range (covers both lb and kg).
 */
export const progressEntrySchema = z
  .object({
    // ISO date string from an <input type="date"> (or empty → today).
    recordedAt: z.string().optional(),
    weight: z
      .number()
      .positive()
      .max(2000)
      .nullable()
      .optional(),
    unit: z.enum(["lb", "kg"]).default("lb"),
    note: z.string().trim().max(500).nullable().optional(),
    photoUrl: z.string().url().nullable().optional(),
  })
  .refine(
    (d) => d.weight != null || d.photoUrl != null || (d.note?.length ?? 0) > 0,
    { message: "Add a weight, a photo, or a note." }
  );

export type ProgressEntryInput = z.infer<typeof progressEntrySchema>;

/**
 * Editing an existing entry. Same fields as a new entry minus the photo (a
 * photo is set once on creation), plus the row id. Weight/note can be cleared.
 */
export const editProgressEntrySchema = z.object({
  id: z.string().uuid(),
  recordedAt: z.string().optional(),
  weight: z.number().positive().max(2000).nullable().optional(),
  unit: z.enum(["lb", "kg"]).default("lb"),
  note: z.string().trim().max(500).nullable().optional(),
});

export type EditProgressEntryInput = z.infer<typeof editProgressEntrySchema>;

export const MEASUREMENT_KINDS = [
  "waist",
  "chest",
  "arms",
  "hips",
  "thighs",
  "shoulders",
  "neck",
] as const;

/** A single body-measurement reading. */
export const bodyMeasurementSchema = z.object({
  recordedAt: z.string().optional(),
  kind: z.enum(MEASUREMENT_KINDS),
  value: z.number().positive().max(500),
  unit: z.enum(["in", "cm"]).default("in"),
});

export type BodyMeasurementInput = z.infer<typeof bodyMeasurementSchema>;
