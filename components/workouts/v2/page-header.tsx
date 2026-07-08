"use client";

// Page header for the workout feature: display-face title with an optional
// single, labeled back link, clear navigation on every screen.

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

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
  const router = useRouter();
  return (
    <header className="mb-6">
      {back && (
        <button
          className="-ml-1.5 mb-2 inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-lg px-1.5 font-semibold text-[14px] text-muted-foreground transition hover:text-foreground"
          onClick={() => {
            // Prefer the real back-stack so scroll position is kept.
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push(back.href);
            }
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
          Back to {back.label}
        </button>
      )}
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
