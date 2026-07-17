"use client";

// Page header for the workout feature: display-face title with an optional
// single, labeled back link, clear navigation on every screen.

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** The workout feature's single back control, also used standalone on the
 *  workout-complete celebration view (RC-1, CMP-15/16), whose custom
 *  centered header replaces WorkoutPageHeader. */
export function WorkoutBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const router = useRouter();
  return (
    <button
      className="-ml-1.5 mb-2 inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-lg px-1.5 font-semibold text-[14px] text-muted-foreground transition hover:text-foreground"
      onClick={() => {
        // The label PROMISES a destination ("Back to your workout"), so
        // always go there. Walking the history stack instead looped
        // through the exercise-picker/custom-form round trip (flaws
        // XPK-16/17: "Back to workout" landed on Add Exercises).
        router.push(href);
      }}
      type="button"
    >
      <svg aria-hidden className="size-4" fill="none" viewBox="0 0 20 20">
        <path
          d="M12.5 4.5 7 10l5.5 5.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      Back to {label}
    </button>
  );
}

export function WorkoutPageHeader({
  title,
  back,
  action,
  subtitle,
}: {
  title: string;
  back?: { href: string; label: string };
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && <WorkoutBackLink href={back.href} label={back.label} />}
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-black font-display text-[30px] text-foreground uppercase leading-none tracking-tight">
          {title}
        </h1>
        {action}
      </div>
      {subtitle && (
        <p className="mt-2 max-w-2xl text-[14px] text-muted-foreground leading-relaxed">
          {subtitle}
        </p>
      )}
    </header>
  );
}
