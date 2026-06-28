"use client";

import { Dumbbell } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Right-hand showcase panel on the auth screens (≥ xl only). Its job is to
 * sell Chad, not the infra underneath (ACC-2): a looping, animated preview of
 * what coaching with Chad actually feels like — a question comes in, Chad
 * "types", then answers in his voice — followed by a rotating real-customer
 * result. Replaces the old "Powered by AI Gateway" + suggestion-chip filler.
 */

// Short exchanges that each showcase a different pillar: accountability, photo
// form-checks, and meal planning — in Chad's blunt, concrete voice.
const SCENES = [
  {
    user: "I've been stuck at the same weight for months.",
    chad: "Because you're guessing. Send me everything you ate today — all of it. We fix the diet first, then we talk training.",
  },
  {
    user: "Can you check my squat form?",
    chad: "Send the video. I'll tell you exactly what's breaking down and the one cue that fixes it.",
  },
  {
    user: "I don't have time to cook.",
    chad: "Nobody does. I'll build you four meals you can make in ten minutes that hit your protein. No excuses.",
  },
];

// Real customer results (names changed for privacy — same source as the
// landing page's testimonials, trimmed for this narrow panel).
const REVIEWS = [
  {
    quote:
      "I paid a trainer for 2 years and got nowhere. Chad found the problem in the first week.",
    name: "Mike R.",
    result: "Lost 22 lbs in 3 months",
  },
  {
    quote:
      "Chad doesn't sugarcoat. He simplified everything and I'm finally seeing results.",
    name: "Sarah T.",
    result: "Finally seeing definition",
  },
  {
    quote: "Like having a coach in my pocket 24/7 who has zero reason to BS me.",
    name: "James K.",
    result: "Down 15 lbs, up in energy",
  },
  {
    quote:
      "The photo analysis blew me away. Chad spotted things I couldn't see.",
    name: "Rachel P.",
    result: "First 5K after years",
  },
];

function ChadAvatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blood/10 ring-1 ring-blood/20">
      <Dumbbell className="text-blood" size={13} strokeWidth={2.5} />
    </span>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border/40 bg-card/40 px-3.5 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          animate={{ opacity: [0.25, 1, 0.25] }}
          className="size-1.5 rounded-full bg-muted-foreground/70"
          key={i}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.18,
          }}
        />
      ))}
    </span>
  );
}

export function Preview() {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0);
  // 0 = just the question · 1 = Chad typing · 2 = Chad's reply
  const [phase, setPhase] = useState(reduce ? 2 : 0);
  const [review, setReview] = useState(0);

  // Drive the conversation timeline for the current scene, then advance.
  useEffect(() => {
    if (reduce) {
      setPhase(2);
      return;
    }
    setPhase(0);
    const toTyping = setTimeout(() => setPhase(1), 650);
    const toReply = setTimeout(() => setPhase(2), 1600);
    const toNext = setTimeout(
      () => setScene((s) => (s + 1) % SCENES.length),
      5400
    );
    return () => {
      clearTimeout(toTyping);
      clearTimeout(toReply);
      clearTimeout(toNext);
    };
  }, [scene, reduce]);

  // Rotate the testimonial independently.
  useEffect(() => {
    if (reduce) {
      return;
    }
    const id = setInterval(
      () => setReview((rev) => (rev + 1) % REVIEWS.length),
      4500
    );
    return () => clearInterval(id);
  }, [reduce]);

  const current = SCENES[scene];
  const r = REVIEWS[review];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-tl-2xl border border-border/20 border-b-0 bg-background">
      {/* Chat-window header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/20 px-5">
        <ChadAvatar />
        <span className="font-medium text-[13px]">Chad</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Online
        </span>
      </div>

      {/* The animated conversation */}
      <div className="flex flex-1 flex-col justify-center gap-4 px-7">
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1 }}
            className="flex flex-col gap-3"
            exit={{ opacity: 0 }}
            initial={{ opacity: reduce ? 1 : 0 }}
            key={scene}
            transition={{ duration: 0.3 }}
          >
            {/* User question */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              transition={{ duration: 0.3 }}
            >
              <p className="max-w-[78%] rounded-2xl rounded-tr-sm bg-muted px-3.5 py-2.5 text-[13px] leading-relaxed">
                {current.user}
              </p>
            </motion.div>

            {/* Chad: typing → reply */}
            <div className="flex items-start gap-2.5">
              <ChadAvatar />
              <div className="min-h-9">
                {phase === 1 && <TypingDots />}
                {phase === 2 && (
                  <motion.p
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border/40 bg-card/50 px-3.5 py-2.5 text-[13px] leading-relaxed"
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    transition={{ duration: 0.35 }}
                  >
                    {current.chad}
                  </motion.p>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rotating proof */}
      <div className="shrink-0 border-t border-border/20 px-7 py-6">
        <AnimatePresence mode="wait">
          <motion.figure
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            key={r.name}
            transition={{ duration: 0.4 }}
          >
            <blockquote className="text-[13px] leading-relaxed text-muted-foreground">
              &ldquo;{r.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-2.5 flex items-center gap-2">
              <span className="font-medium text-[12px]">{r.name}</span>
              <span className="font-mono text-[10px] text-blood uppercase tracking-[0.12em]">
                {r.result}
              </span>
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>
    </div>
  );
}
