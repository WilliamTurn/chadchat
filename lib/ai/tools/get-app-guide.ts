import { tool } from "ai";
import { z } from "zod";
import { APP_GUIDE_TOPIC_IDS, formatAppGuide } from "@/lib/ai/app-guide";

/**
 * CHT-9: lets Chad answer "how does X work in the app?" from the maintained
 * app guide (lib/ai/app-guide.ts) instead of guessing, without the guide
 * living in his system prompt. Static content, no user data, no session
 * needed. Omitting topics returns the whole guide, so retrieval can't miss.
 */
export const getAppGuide = tool({
  description:
    "Look up how this app itself works: its features and what each page does, how to log or edit things, what the plans (Basic/Pro/Elite) cost and include, billing and cancellation, account settings, data export, privacy, and troubleshooting. Call this whenever the client asks an app question ('how do I log a meal?', 'where do I change my card?', 'what's trend weight?', 'what do I get on Elite?') and answer from what it returns instead of guessing. Pass the relevant topic ids, or omit them to get the full guide.",
  inputSchema: z.object({
    topics: z
      .array(z.enum(APP_GUIDE_TOPIC_IDS as [string, ...string[]]))
      .nullable()
      .optional()
      .describe(
        "Which sections to fetch. Omit for the full guide (it's short)."
      ),
  }),
  execute: ({ topics }) => Promise.resolve(formatAppGuide(topics)),
});
