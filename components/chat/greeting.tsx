"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { Dumbbell } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";
import type { ChatMessage } from "@/lib/types";
import { SuggestedActions } from "./suggested-actions";
import type { VisibilityType } from "./visibility-selector";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The empty-chat branded hero (CHT-1): the dumbbell mark in a blood-glow
 * badge, the headline, a one-line promise, and the example-prompt chips —
 * one composed, stagger-revealed unit centered in the empty space (the chips
 * used to float separately above the composer). The chips keep their
 * "Hide suggestions" dismissal (same localStorage key as before, so an
 * earlier dismissal still holds); the mark + headline always show.
 */
export const Greeting = ({
  chatId,
  sendMessage,
  selectedVisibilityType,
  isReadonly = false,
}: {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
  isReadonly?: boolean;
}) => {
  const [hideSuggestions, setHideSuggestions] = useLocalStorage(
    "chad-hide-suggestions",
    false
  );

  return (
    <div
      className="my-auto flex w-full flex-col items-center gap-5 px-4 py-10"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        initial={{ opacity: 0, scale: 0.85, y: 12 }}
        transition={{ delay: 0.05, duration: 0.5, ease: EASE }}
      >
        <div className="flex size-16 items-center justify-center rounded-2xl border border-blood/30 bg-blood-dim shadow-[0_0_48px_8px_rgba(164,22,26,0.22)]">
          <Dumbbell aria-hidden className="size-8 text-blood" strokeWidth={2.5} />
        </div>
      </motion.div>

      <motion.h1
        animate={{ opacity: 1, y: 0 }}
        className="text-center font-display font-semibold text-3xl tracking-tight text-foreground md:text-4xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.18, duration: 0.5, ease: EASE }}
      >
        Let&apos;s get to work.
      </motion.h1>

      <motion.p
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md text-center text-muted-foreground text-sm leading-relaxed md:text-base"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
      >
        Tell Chad what you&apos;re chasing. He builds the plan, tracks the
        work, and holds you to it.
      </motion.p>

      {!(isReadonly || hideSuggestions) && (
        <div className="mt-3 w-full max-w-2xl">
          <SuggestedActions
            baseDelay={0.42}
            chatId={chatId}
            onHide={() => setHideSuggestions(true)}
            selectedVisibilityType={selectedVisibilityType}
            sendMessage={sendMessage}
          />
        </div>
      )}
    </div>
  );
};
