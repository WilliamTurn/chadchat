"use client";

import {
  Check,
  Crown,
  FileText,
  Loader2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ReportView } from "@/components/reports/report-view";
import { Button } from "@/components/ui/button";
import type { WeeklyReportContent } from "@/lib/reports/content";
import { cn } from "@/lib/utils";

/**
 * The non-Elite /reports teaser (ACC-24, grown from VF-6's static blur).
 * Instead of opening straight on a paywall, the member presses a real
 * "generate" button, watches a short "Chad is crunching your week" working
 * animation, and THEN the finished-looking (blurred) report + the Elite CTA
 * land at the curiosity peak.
 *
 * Honesty rules: the report content is a fixed, clearly-labeled SAMPLE week.
 * Every number in it is invented for the mock and it is never presented as the
 * member's own data; the working steps say "sample" out loud.
 */

/** What a real weekly report looks like (static sample content). */
const SAMPLE_REPORT: WeeklyReportContent = {
  headline: "Four workouts in, protein still 20g short",
  intro:
    "You trained four times this week and hit every planned workout. Bodyweight moved from 214.2 to 212.9, right on the pace we set. Protein is the weak spot: you averaged 158g against a 180g target, and every day you missed it was a day you skipped the evening shake.",
  sections: [
    {
      title: "Training",
      body: "Four workouts logged: two lower, two upper. Squat top set moved 265 to 275 for the same five reps. Total volume 38,450 lb, up 6% on last week. Bench stalled at 205; bar speed on the last set says fatigue, not weakness.",
    },
    {
      title: "Nutrition",
      body: "Averages: 2,140 calories, 158g protein, 212g carbs, 71g fat. Five of seven days inside the calorie target. Protein missed on Tuesday, Friday and Sunday.",
    },
    {
      title: "Bodyweight",
      body: "214.2 to 212.9 lb. The trend line puts you 1.3 lb down on the week, inside the range we want for holding muscle on a cut.",
    },
  ],
  adjustments: [
    {
      change: "Put the evening shake back on training days",
      reason: "every protein miss this week was a day you skipped it",
    },
    {
      change: "Hold bench at 205 and add a back-off set",
      reason: "the top set stalled two workouts in a row",
    },
  ],
  bottomLine:
    "The cut is working and the squat is climbing. Fix the protein and next week's report has nothing to complain about.",
};

/** The staged "Chad is working" lines. One lights up every WORK_STEP_MS. */
const WORK_STEPS = [
  "Reading the week's training log",
  "Adding up the macros, day by day",
  "Checking where the weight trend is heading",
  "Writing next week's adjustments",
] as const;

const WORK_STEP_MS = 750;

type Phase = "idle" | "working" | "revealed";

export function ReportTeaser() {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepsDone, setStepsDone] = useState(0);

  // Advance one working step at a time, then reveal. Interval-free chain of
  // timeouts so unmount mid-run cleans up with a single clearTimeout.
  useEffect(() => {
    if (phase !== "working") {
      return;
    }
    if (stepsDone >= WORK_STEPS.length) {
      const t = setTimeout(() => setPhase("revealed"), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepsDone((n) => n + 1), WORK_STEP_MS);
    return () => clearTimeout(t);
  }, [phase, stepsDone]);

  function handleGenerate() {
    // Reduced motion: skip the theater, land on the result immediately.
    if (prefersReducedMotion) {
      setPhase("revealed");
      return;
    }
    setStepsDone(0);
    setPhase("working");
  }

  if (phase === "idle") {
    return (
      // Centered hero card on the wide LAY-1 frame (the locked-feature
      // pattern), instead of one stranded full-width band.
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-8 text-center sm:p-10">
        <p className="font-semibold text-blood text-xs uppercase tracking-[0.2em]">
          Weekly report · Elite
        </p>
        <h2 className="mt-3 font-semibold text-xl tracking-tight">
          See what Chad writes about a week of training
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
          Every week, Chad reads an Elite member's full log and writes a
          coach's report: what they trained, how they ate, where the weight is
          heading, and exactly what changes next week. Generate a sample week
          and read one.
        </p>
        <Button className="mt-6 gap-2" onClick={handleGenerate} size="lg">
          <FileText className="size-4" />
          Generate a sample report
        </Button>
      </div>
    );
  }

  if (phase === "working") {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-8 sm:p-10">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-blood/10">
            <Loader2 className="size-6 animate-spin text-blood" />
          </div>
          <h2 className="mt-4 font-semibold text-xl tracking-tight">
            Chad is crunching the week
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Building the sample report&hellip;
          </p>

          <ul className="mt-6 flex w-full max-w-sm flex-col gap-3 text-left">
            {WORK_STEPS.map((step, i) => {
              const done = i < stepsDone;
              const active = i === stepsDone;
              return (
                <motion.li
                  animate={{ opacity: done || active ? 1 : 0.35 }}
                  className="flex items-center gap-2.5 text-sm"
                  initial={false}
                  key={step}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      done
                        ? "border-blood bg-blood text-white"
                        : "border-border text-transparent"
                    )}
                  >
                    {done ? (
                      <Check className="size-3" />
                    ) : active ? (
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    ) : null}
                  </span>
                  <span
                    className={
                      done || active
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {step}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={
          prefersReducedMotion ? false : { opacity: 0, y: 12 }
        }
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="relative mx-auto max-h-[560px] w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card">
          {/* The blurred sample report behind the prompt: decorative only. */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none p-6 opacity-85 blur-[5px] sm:p-8"
          >
            <ReportView content={SAMPLE_REPORT} dateLabel="Sample week" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-background/50 to-background/90 p-6">
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md rounded-2xl border border-border/60 bg-background/85 p-6 text-center shadow-[var(--shadow-float)] backdrop-blur-sm"
              initial={
                prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }
              }
              transition={{ delay: 0.25, duration: 0.3, ease: "easeOut" }}
            >
              <h2 className="font-medium text-lg">
                Your report is ready to be written
              </h2>
              <p className="mt-2 text-muted-foreground text-sm">
                That was a sample week. Upgrade to Elite and Chad writes the
                real one from your own logs, every week: what you trained, how
                you ate, where your weight is heading, and exactly what
                changes next week, delivered to your inbox.
              </p>
              <Button asChild className="mt-5 gap-1.5">
                <Link href="/account">
                  <Crown className="size-4" />
                  Upgrade to Elite
                </Link>
              </Button>
              <p className="mt-3 text-muted-foreground text-xs">
                The blurred report behind this card is a sample, not your
                data.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
