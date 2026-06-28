"use client";

import { cn } from "@/lib/utils";

/**
 * Lightweight, dependency-free password-strength feedback for the new-password
 * screens (register + reset). This is UX nudging only — it is NOT the security
 * control. The real rule (8+ characters) is enforced by zod on the client and
 * re-enforced in the server action.
 *
 * Score 0–4 from two axes: length tiers (8+, 12+) and character variety
 * (lower/upper/digit/symbol). A password under the 8-char minimum can never
 * read above "Weak" so the meter and the hard rule never contradict.
 */
function scorePassword(password: string): number {
  if (!password) {
    return 0;
  }

  let score = 0;
  if (password.length >= 8) {
    score++;
  }
  if (password.length >= 12) {
    score++;
  }

  const variety =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/\d/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  if (variety >= 2) {
    score++;
  }
  if (variety >= 3) {
    score++;
  }

  if (password.length < 8) {
    return Math.min(score, 1);
  }
  return Math.min(score, 4);
}

const LEVELS = [
  { label: "", className: "" },
  { label: "Weak", className: "bg-destructive" },
  { label: "Fair", className: "bg-orange-500" },
  { label: "Good", className: "bg-yellow-500" },
  { label: "Strong", className: "bg-emerald-500" },
] as const;

export function PasswordStrength({ password }: { password: string }) {
  if (!password) {
    return null;
  }

  const score = scorePassword(password);
  const level = LEVELS[score];

  return (
    <div aria-live="polite" className="flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((segment) => (
          <span
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              segment <= score ? level.className : "bg-border"
            )}
            key={segment}
          />
        ))}
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
        {level.label}
      </span>
    </div>
  );
}
