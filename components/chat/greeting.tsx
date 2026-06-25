"use client";

import { motion } from "framer-motion";
import { Dumbbell } from "lucide-react";
import { MessageContent, MessageResponse } from "../ai-elements/message";

// Pre-seeded intro so a new user lands on Chad talking, not a blank screen.
// Presentational only — not stored and not sent to the model as context, so it
// can't break the user-first message ordering the LLM expects. Matches Chad's
// canonical new-user greeting from his system prompt (introduce, state the
// mission, ask what they're here to do — direct, not hostile).
const INTRO = `I'm Chad — your coach. No games, no excuses. I take soft people and turn them into hard ones who actually hit their goals — **real results**, not wishful thinking.

Before I build your plan I need to know who I'm working with, and we'll do it one step at a time.

So tell me — what are you here to do? Build muscle, drop fat, get stronger? Let's get to work.`;

export const Greeting = () => {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="group/message message-fade-in w-full"
      data-role="assistant"
      data-testid="greeting"
      initial={{ opacity: 0, y: 10 }}
      key="overview"
      transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-[calc(16px*1.65)] shrink-0 items-center">
          <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border/50">
            <Dumbbell className="text-blood" size={14} strokeWidth={2.5} />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <MessageContent className="text-[16px] leading-[1.65]">
            <MessageResponse>{INTRO}</MessageResponse>
          </MessageContent>
        </div>
      </div>
    </motion.div>
  );
};
