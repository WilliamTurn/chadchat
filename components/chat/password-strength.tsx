"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_REQUIREMENTS } from "@/lib/validation/auth";

/**
 * Password strength indicator for the new-password screens (sign up + reset).
 *
 * This is a faithful port of Origin UI's `comp-51` — the "Input with password
 * strength indicator" component from github.com/origin-space/originui
 * (commit 731f798, apps/origin/registry/default/components/comp-51.tsx, installable
 * via `npx shadcn@latest add https://originui.com/r/comp-51.json`). Its
 * strength-scoring, color/label helpers, single progress bar, and Check/X
 * requirement list are kept as in the original.
 *
 * Two deliberate adaptations: (1) the <input> + show/hide toggle live in
 * <PasswordInput> inside our react-hook-form field, so this component just takes
 * the current `password` as a prop instead of owning input state; and (2) it
 * reads its requirement list from PASSWORD_REQUIREMENTS (our shared source of
 * truth) so the checklist is exactly what zod enforces on submit.
 */

// Origin UI comp-51, verbatim.
function getStrengthColor(score: number) {
  if (score === 0) {
    return "bg-border";
  }
  if (score <= 1) {
    return "bg-red-500";
  }
  if (score <= 2) {
    return "bg-orange-500";
  }
  if (score === 3) {
    return "bg-amber-500";
  }
  return "bg-emerald-500";
}

// Origin UI comp-51, verbatim.
function getStrengthText(score: number) {
  if (score === 0) {
    return "Enter a password";
  }
  if (score <= 2) {
    return "Weak password";
  }
  if (score === 3) {
    return "Medium password";
  }
  return "Strong password";
}

export function PasswordStrength({ password }: { password: string }) {
  // Only appear once the user starts typing, so the empty sign-up form stays
  // short and the submit button is visible without scrolling.
  if (!password) {
    return null;
  }

  const strength = PASSWORD_REQUIREMENTS.map((req) => ({
    met: req.test(password),
    text: req.label,
  }));
  const strengthScore = strength.filter((req) => req.met).length;

  return (
    <div className="mt-2">
      {/* Strength bar + inline label — compact, secondary helper, not a
          centerpiece. */}
      <div className="flex items-center gap-2">
        <div
          aria-label="Password strength"
          aria-valuemax={4}
          aria-valuemin={0}
          aria-valuenow={strengthScore}
          className="h-1 flex-1 overflow-hidden rounded-full bg-border"
          role="progressbar"
          tabIndex={-1}
        >
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out",
              getStrengthColor(strengthScore)
            )}
            style={{ width: `${(strengthScore / 4) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground uppercase tracking-wide">
          {getStrengthText(strengthScore)}
        </span>
      </div>

      {/* Requirements checklist — tiny, two columns so it stays two short rows. */}
      <ul
        aria-label="Password requirements"
        className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1"
      >
        {strength.map((req) => (
          <li className="flex items-center gap-1.5" key={req.text}>
            {req.met ? (
              <CheckIcon
                aria-hidden="true"
                className="shrink-0 text-emerald-500"
                size={12}
              />
            ) : (
              <XIcon
                aria-hidden="true"
                className="shrink-0 text-muted-foreground/60"
                size={12}
              />
            )}
            <span
              className={cn(
                "text-[11px] leading-none",
                req.met
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-muted-foreground"
              )}
            >
              {req.text}
              <span className="sr-only">
                {req.met ? " - Requirement met" : " - Requirement not met"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
