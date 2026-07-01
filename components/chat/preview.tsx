"use client";

import { Dumbbell } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Right-hand showcase panel on the auth screens (≥ xl only), ACC-16.
 *
 * Replaces the old full-height chat demo with a cinematic, auto-advancing
 * montage — the login equivalent of a hard-cut hype reel. Gritty, desaturated
 * black-and-white training photography (single blood-red accent) is intercut
 * with two "product" beats — a dashboard stat and Chad firing off a text — so
 * the panel sells both the intensity AND the fact that there's a real product
 * behind it. Story-style progress bars, Ken Burns push-ins, and hard cross-cuts
 * do the dazzling; there is no live chat stream to out-run the reader.
 */

type Scene =
  | {
      kind: "photo";
      src: string;
      // Object position so the crop keeps the subject in frame on a tall panel.
      position?: string;
      kicker: string;
      caption: string;
      ms: number;
    }
  | { kind: "stat"; ms: number }
  | { kind: "text"; ms: number };

const SCENES: Scene[] = [
  {
    kind: "photo",
    src: "/images/login/lift.webp",
    position: "50% 35%",
    kicker: "Day 41",
    caption: "The day you don't want to.\nThat's the one that counts.",
    ms: 4200,
  },
  { kind: "stat", ms: 4200 },
  {
    kind: "photo",
    src: "/images/login/squat.webp",
    position: "50% 40%",
    kicker: "No excuses",
    caption: "Chad doesn't negotiate.\nAnd neither will you.",
    ms: 4200,
  },
  { kind: "text", ms: 5600 },
  {
    kind: "photo",
    src: "/images/login/dawn.webp",
    position: "50% 30%",
    kicker: "4:17 AM",
    caption: "Nobody is coming to save you.\nGet up.",
    ms: 4600,
  },
  {
    kind: "photo",
    src: "/images/login/grip.webp",
    position: "50% 50%",
    kicker: "Chalk up",
    caption: "Stop thinking.\nStart working.",
    ms: 4000,
  },
];

function ChadMark() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blood/15 ring-1 ring-blood/30">
      <Dumbbell className="text-blood" size={14} strokeWidth={2.5} />
    </span>
  );
}

/** Word-by-word rise used for every scene's caption. */
function Caption({ kicker, text }: { kicker: string; text: string }) {
  const lines = text.split("\n");
  return (
    <div>
      <motion.span
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 inline-block font-mono text-[11px] text-blood uppercase tracking-[0.24em]"
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        {kicker}
      </motion.span>
      <p className="font-display font-bold text-[26px] text-white leading-[1.15] tracking-tight [text-shadow:0_2px_20px_rgba(0,0,0,0.6)]">
        {lines.map((line, li) => (
          <span className="block overflow-hidden" key={line}>
            <motion.span
              animate={{ y: "0%" }}
              className="inline-block"
              initial={{ y: "110%" }}
              transition={{
                duration: 0.65,
                delay: 0.25 + li * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </p>
    </div>
  );
}

function PhotoScene({
  src,
  position,
  priority,
}: {
  src: string;
  position?: string;
  priority?: boolean;
}) {
  return (
    <motion.div
      animate={{ scale: 1.12 }}
      className="absolute inset-0"
      initial={{ scale: 1 }}
      transition={{ duration: 6, ease: "linear" }}
    >
      <Image
        alt=""
        className="object-cover grayscale-[0.15]"
        fill
        priority={priority}
        sizes="(min-width: 1280px) 55vw, 0px"
        src={src}
        style={{ objectPosition: position ?? "50% 50%" }}
        // These are already resized/compressed WebPs (≤130 KB); skip the
        // Next optimizer so they render identically in every environment.
        unoptimized
      />
    </motion.div>
  );
}

/** A dashboard beat — animated numbers + a red trend line, "screen-recording" feel. */
function StatScene() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-8 bg-[#0a0a0b] px-10">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-[12px] text-muted-foreground"
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.5 }}
      >
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Your progress · this month
      </motion.div>

      <div className="flex gap-10">
        {[
          { value: "−9", unit: "lbs", label: "Body weight" },
          { value: "41", unit: "days", label: "Streak" },
          { value: "+25", unit: "lbs", label: "Squat 1RM" },
        ].map((s, i) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-1"
            initial={{ opacity: 0, y: 14 }}
            key={s.label}
            transition={{ duration: 0.5, delay: 0.15 + i * 0.12 }}
          >
            <span className="flex items-baseline gap-1">
              <span className="font-display font-bold text-[40px] text-white leading-none tabular-nums">
                {s.value}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {s.unit}
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
              {s.label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Sparkline that draws itself, in blood-red. */}
      <svg
        aria-hidden
        className="w-full"
        fill="none"
        height="64"
        preserveAspectRatio="none"
        viewBox="0 0 320 64"
      >
        <title>Trend</title>
        <motion.path
          animate={{ pathLength: 1 }}
          d="M0 52 C40 50 60 40 90 38 S150 30 180 24 240 16 320 6"
          initial={{ pathLength: 0 }}
          stroke="#a4161a"
          strokeLinecap="round"
          strokeWidth="2.5"
          transition={{ duration: 1.8, ease: "easeInOut", delay: 0.4 }}
        />
      </svg>

      <div className="font-display font-bold text-[22px] text-white leading-tight">
        A coach who actually
        <span className="text-blood"> keeps score.</span>
      </div>
    </div>
  );
}

/** Chad firing off a text — the product's blunt accountability, verbatim. */
function TextScene() {
  const [typed, setTyped] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTyped(true), 1400);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-4 bg-[#0a0a0b] px-10">
      <div className="mb-1 flex items-center gap-2.5">
        <ChadMark />
        <span className="font-medium text-[13px] text-white">Chad</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          now
        </span>
      </div>

      {/* User's excuse */}
      <motion.p
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[75%] self-end rounded-2xl rounded-tr-sm bg-muted px-4 py-2.5 text-[14px] text-foreground leading-relaxed"
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.4 }}
      >
        Not feeling it today.
      </motion.p>

      {/* Chad: typing → the line */}
      <div className="min-h-[92px]">
        <AnimatePresence mode="wait">
          {typed ? (
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="max-w-[86%] rounded-2xl rounded-tl-sm border border-blood/30 bg-blood/10 px-4 py-3 font-medium text-[16px] text-white leading-snug"
              initial={{ opacity: 0, y: 10 }}
              key="msg"
              transition={{ duration: 0.4 }}
            >
              Nobody is coming to save you. Go put in the fucking work. NOW.
            </motion.p>
          ) : (
            <motion.span
              className="inline-flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border/40 bg-card/40 px-4 py-3.5"
              exit={{ opacity: 0 }}
              key="dots"
            >
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
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Preview() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) {
      return;
    }
    const id = setTimeout(
      () => setIndex((i) => (i + 1) % SCENES.length),
      SCENES[index].ms
    );
    return () => clearTimeout(id);
  }, [index, reduce]);

  const scene = SCENES[index];

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/20 bg-black">
      {/* Story-style progress segments */}
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1.5 p-4">
        {SCENES.map((s, i) => (
          <span
            className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20"
            key={`${s.kind}-${i}`}
          >
            <motion.span
              animate={{
                width: i < index ? "100%" : i === index ? "100%" : "0%",
              }}
              className="block h-full bg-white"
              initial={{ width: i < index ? "100%" : "0%" }}
              transition={{
                duration: i === index && !reduce ? scene.ms / 1000 : 0,
                ease: "linear",
              }}
            />
          </span>
        ))}
      </div>

      {/* Brand chip, always visible */}
      <div className="absolute top-7 left-4 z-20 flex items-center gap-2 text-[12px] text-white/80">
        <Dumbbell className="text-blood" size={14} strokeWidth={2.5} />
        <span className="font-medium">The coach that won't let you quit.</span>
      </div>

      {/* The montage */}
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1 }}
          className="absolute inset-0"
          exit={{ opacity: 0 }}
          initial={{ opacity: reduce ? 1 : 0 }}
          key={index}
          transition={{ duration: 0.5 }}
        >
          {scene.kind === "photo" && (
            <PhotoScene
              position={scene.position}
              priority={index === 0}
              src={scene.src}
            />
          )}
          {scene.kind === "stat" && <StatScene />}
          {scene.kind === "text" && <TextScene />}

          {/* Legibility gradient + caption for photo scenes */}
          {scene.kind === "photo" && (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 p-10">
                <Caption kicker={scene.kicker} text={scene.caption} />
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
