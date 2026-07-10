import "server-only";

import { put } from "@vercel/blob";
import { editImageFromReferences } from "@/lib/ai/image-gen";
import { formatCalendarDay } from "@/lib/date";
import { updateFutureYouForecast } from "@/lib/db/queries";
import type { Goal, User } from "@/lib/db/schema";
import { draftForecast, GOAL_STATE_KIT, REALISM_KIT } from "./architect";
import type { FutureYouContent, FutureYouFrame } from "./content";
import type { MilestonePlan } from "./milestones";

/**
 * The Future You generation pipeline (FEAT-29), run in the background after
 * the start action returns (the page polls the row). Order:
 *
 *   1. architect, one vision pass over the member's photos + the checkpoint
 *      math → per-frame image prompts and all member-facing text.
 *   2. images, every frame generated IN PARALLEL through gpt-image-2 edits
 *      (the member's photos as identity references), so wall clock is one
 *      image call, not four.
 *   3. store, each PNG into Blob, content assembled, row flipped to ready.
 *
 * Any failure flips the row to failed with a member-facing message; failed
 * runs don't count against the fair-use cap.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function frameDateLabel(weekOffset: number): string {
  return formatCalendarDay(new Date(Date.now() + weekOffset * WEEK_MS), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function generateFrame({
  userId,
  kind,
  weekOffset,
  imagePrompt,
  caption,
  expectedWeightLabel,
  photoUrls,
  isGoalFrame = false,
}: {
  userId: string;
  kind: "work" | "quit";
  weekOffset: number;
  imagePrompt: string;
  caption: string;
  expectedWeightLabel: string | null;
  photoUrls: string[];
  /** The final work frame: gets the code-enforced goal-achieved kit. */
  isGoalFrame?: boolean;
}): Promise<FutureYouFrame> {
  const png = await editImageFromReferences({
    prompt: `${imagePrompt}${isGoalFrame ? GOAL_STATE_KIT : ""}${REALISM_KIT}`,
    referenceUrls: photoUrls,
  });
  const stored = await put(
    `future-you/${userId}/${kind}-week-${weekOffset}.png`,
    png,
    { access: "public", addRandomSuffix: true, contentType: "image/png" }
  );
  return {
    kind,
    weekOffset,
    dateLabel: frameDateLabel(weekOffset),
    imageUrl: stored.url,
    expectedWeightLabel,
    caption,
  };
}

/**
 * Run the whole pipeline for an already-created pending forecast row and
 * resolve it (ready or failed). Never throws, this runs detached.
 */
export async function runForecastPipeline({
  forecastId,
  user,
  goal,
  plan,
  photoUrls,
  currentWeightLabel,
}: {
  forecastId: string;
  user: User;
  goal: Goal;
  plan: MilestonePlan;
  photoUrls: string[];
  currentWeightLabel: string | null;
}): Promise<void> {
  try {
    const draft = await draftForecast({
      user,
      goal,
      plan,
      photoUrls,
      currentWeightLabel,
    });

    const workJobs = plan.checkpoints.map((checkpoint, i) =>
      generateFrame({
        userId: user.id,
        kind: "work",
        weekOffset: checkpoint.weekOffset,
        imagePrompt: draft.workFrames[i].imagePrompt,
        caption: draft.workFrames[i].caption,
        expectedWeightLabel:
          checkpoint.expectedWeight != null
            ? `About ${checkpoint.expectedWeight} ${plan.unit}`
            : null,
        photoUrls,
        // The last checkpoint IS the goal: it gets the goal-achieved kit.
        isGoalFrame: i === plan.checkpoints.length - 1,
      })
    );
    const quitJob = generateFrame({
      userId: user.id,
      kind: "quit",
      weekOffset: plan.quitWeek,
      imagePrompt: draft.quitFrame.imagePrompt,
      caption: draft.quitFrame.caption,
      expectedWeightLabel: null,
      photoUrls,
    });

    const frames = await Promise.all([...workJobs, quitJob]);

    const content: FutureYouContent = {
      goalTitle: goal.title,
      physiqueRead: draft.physiqueRead,
      frames,
      verdict: draft.verdict,
    };

    await updateFutureYouForecast({
      id: forecastId,
      status: "ready",
      content,
    });
  } catch (error) {
    console.error("[future-you] forecast pipeline failed:", error);
    await updateFutureYouForecast({
      id: forecastId,
      status: "failed",
      error:
        "Chad couldn't finish your forecast this time. Your photos are fine; hit Generate again.",
    }).catch((updateError) => {
      console.error(
        "[future-you] failed to mark forecast as failed:",
        updateError
      );
    });
  }
}
