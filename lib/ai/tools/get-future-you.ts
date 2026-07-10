import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { getLatestFutureYouForecast } from "@/lib/db/queries";
import {
  parseFutureYouContent,
  quitFrame,
  workFrames,
} from "@/lib/future-you/content";

type GetFutureYouProps = {
  session: Session;
};

/**
 * Read-only access to the member's latest Future You forecast (FEAT-29) so
 * Chad can talk about it in chat: reference the dated checkpoints, hold the
 * member to the dates, and compare the projection against what they're
 * actually logging. Owner-scoped via the session.
 */
export const getFutureYou = ({ session }: GetFutureYouProps) =>
  tool({
    description:
      "Read this client's latest Future You forecast: the dated photos of what they will look like at each checkpoint on the way to their active goal if they do the work, plus the photo of where they land if they quit, all calculated from their own photos, goal, and pace. Returns the goal it was computed against, your physique read at generation time, each checkpoint (week number, calendar date, expected weight, caption), the quit frame, and your verdict. Use it when the member mentions their forecast, asks how far along they should be, or needs the dates put back in front of them. If they have no forecast yet, this returns that too; the place to make one is the Future You page (/future-you).",
    inputSchema: z.object({}),
    execute: async () => {
      const latest = await getLatestFutureYouForecast(session.user.id);
      if (!latest) {
        return "No Future You forecast exists yet. The member creates one on the Future You page (/future-you): they submit 3 to 6 clear photos of themselves and the forecast is generated from their active goal. It's a Pro feature.";
      }
      if (latest.status === "pending") {
        return "Their Future You forecast is being generated right now. It will be on the Future You page (/future-you) in a few minutes.";
      }
      if (latest.status === "failed") {
        return "Their last Future You run failed before finishing. They can start it again on the Future You page (/future-you).";
      }
      const content = parseFutureYouContent(latest.content);
      if (!content) {
        return "Their forecast exists but couldn't be read. Send them to the Future You page (/future-you) to view or regenerate it.";
      }
      const checkpoints = workFrames(content)
        .map(
          (f) =>
            `- Week ${f.weekOffset} (${f.dateLabel}${f.expectedWeightLabel ? `, ${f.expectedWeightLabel.toLowerCase()}` : ""}): ${f.caption}`
        )
        .join("\n");
      const quit = quitFrame(content);
      return [
        `FUTURE YOU FORECAST (generated ${latest.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, viewable on /future-you)`,
        `Goal: ${content.goalTitle}`,
        `Physique read at generation: ${content.physiqueRead}`,
        "Checkpoints if they do the work:",
        checkpoints,
        quit ? `If they quit (${quit.dateLabel}): ${quit.caption}` : null,
        `Verdict on record: ${content.verdict}`,
      ]
        .filter(Boolean)
        .join("\n");
    },
  });
