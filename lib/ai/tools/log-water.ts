import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { canAccessProFeatures } from "@/lib/admin";
import { addWaterLog } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { ozToMl } from "@/lib/today/water-units";

type LogWaterProps = {
  session: Session;
  user: User;
};

// Same per-entry sanity cap as the water tracker's server action: one row never
// exceeds a 1 L jug. A bigger reported total is split into capped rows so the
// daily sum stays exact without any single fat-fingered row poisoning the log.
const MAX_ENTRY_ML = 2000;

// Hard ceiling on one reported amount (~2 gallons, mirroring the max daily
// goal). Guards against a garbled number turning into 50 rows.
const MAX_TOTAL_ML = 7600;

/**
 * Lets Chad log the client's reported water intake into the hydration tracker
 * (FEAT-14). The client reports a number + unit; the oz→ml conversion happens
 * here in code (same `ozToMl` the tracker's buttons use), never in the model.
 * Water rows are timestamped "now" (the tracker has no backdating), so this
 * only logs for today. Pro-gated like the page.
 */
export const logWater = ({ session, user }: LogWaterProps) =>
  tool({
    description:
      "Log water the client reports drinking TODAY into their hydration tracker. Use when they tell you how much they drank and either ask you to log it or say yes when you offer. Pass the amount and unit exactly as they said it; the conversion is handled for you. Water can only be logged for today, not past days. Never log water they didn't report.",
    inputSchema: z.object({
      amount: z
        .number()
        .positive()
        .describe("How much they drank, in the given unit."),
      unit: z
        .enum(["oz", "ml"])
        .default("oz")
        .describe("The unit the client used. US clients usually mean oz."),
    }),
    execute: async ({ amount, unit }) => {
      if (!canAccessProFeatures(user)) {
        return {
          error:
            "This client's plan doesn't include hydration tracking; it's part of Chad Pro. Tell them to upgrade to have you track their water.",
        };
      }

      const totalMl = Math.min(
        unit === "oz" ? ozToMl(amount) : Math.round(amount),
        MAX_TOTAL_ML
      );
      if (totalMl <= 0) {
        return { error: "That water amount doesn't make sense." };
      }

      let remaining = totalMl;
      while (remaining > 0) {
        const entry = Math.min(remaining, MAX_ENTRY_ML);
        await addWaterLog({ userId: session.user.id, amountMl: entry });
        remaining -= entry;
      }

      return {
        loggedMl: totalMl,
        message: `${amount} ${unit} of water (${totalMl} ml) logged to the client's hydration tracker for today.`,
      };
    },
  });
