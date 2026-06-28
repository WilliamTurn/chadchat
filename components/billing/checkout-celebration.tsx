"use client";

import { ArrowRight, Dumbbell } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Post-checkout celebration (ACC-1). The moment a user pays is the highest
 * emotional point in the funnel — the old page showed a bare spinner and
 * silently redirected. This gives it a real "you're in" beat: a one-shot red
 * burst, the CHAD mark, and a deliberate "Open Chad" CTA instead of an
 * automatic bounce into the app. Reduced-motion users get the same screen,
 * statically.
 */

const BURST_COLORS = ["#a4161a", "#e5484d", "#f5c6cb", "#ffffff", "#facc15"];

// Precomputed (module-level, deterministic) so server and client render the
// same particles — no Math.random in render, no hydration mismatch.
const PARTICLES = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2;
  const distance = 130 + (i % 5) * 28;
  return {
    id: i,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    color: BURST_COLORS[i % BURST_COLORS.length],
    size: 6 + (i % 3) * 3,
    delay: (i % 6) * 0.02,
  };
});

function Burst() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {PARTICLES.map((p) => (
        <motion.span
          animate={{
            x: p.x,
            y: p.y,
            opacity: [1, 1, 0],
            scale: [0, 1, 0.6],
          }}
          className="absolute rounded-[2px]"
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          key={p.id}
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          transition={{ duration: 1.1, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export function CheckoutCelebration() {
  const reduce = useReducedMotion();

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* Warm radial glow behind the moment */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blood/[0.08] blur-3xl"
      />

      {!reduce && <Burst />}

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="relative flex flex-col items-center gap-5"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        transition={{ duration: 0.5, delay: reduce ? 0 : 0.15 }}
      >
        <motion.span
          animate={{ scale: 1 }}
          className="flex size-16 items-center justify-center rounded-2xl bg-blood/10 ring-1 ring-blood/25"
          initial={reduce ? false : { scale: 0.4 }}
          transition={{ type: "spring", stiffness: 380, damping: 16 }}
        >
          <Dumbbell className="text-blood" size={30} strokeWidth={2.5} />
        </motion.span>

        <div className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-3xl tracking-tight">
            You&apos;re in.
          </h1>
          <p className="text-muted-foreground">
            Welcome to Chad. No more excuses — let&apos;s get to work.
          </p>
        </div>

        <Button asChild className="mt-2 gap-2" size="lg">
          <Link href="/">
            Open Chad
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </motion.div>
    </main>
  );
}
