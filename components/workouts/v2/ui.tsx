"use client";

// Shared primitives for the workout feature. Every control is sized for
// one-handed gym use: minimum 44px touch targets, labels on every icon.
// Colors come from the app theme tokens so light and dark both work.

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // RC-3 (Q-C): a primary CTA BEGINS or ADVANCES something (start / finish /
  // save / add), so it is the go-action green, not blood. Dark ink on the
  // bright go hue for contrast (mirrors the /design-system .btn-go spec).
  primary:
    "bg-[var(--go)] text-[var(--bg)] font-semibold shadow-[0_8px_24px_-6px_var(--go)] hover:brightness-110 active:scale-[0.98]",
  secondary:
    "bg-card text-foreground border border-input font-semibold hover:bg-muted/60 active:scale-[0.98]",
  ghost:
    "text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98]",
  danger:
    "bg-transparent text-blood border border-blood/40 font-semibold hover:bg-blood/10 active:scale-[0.98]",
  success:
    "bg-emerald-500 text-white font-bold hover:brightness-110 active:scale-[0.98]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "lg" | "sm";
  loading?: boolean;
}

export function WButton({
  variant = "secondary",
  size = "md",
  loading,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const sizeClasses =
    size === "lg"
      ? "min-h-[56px] px-6 text-[17px] rounded-2xl"
      : size === "sm"
        ? "min-h-[40px] px-3.5 text-[14px] rounded-xl"
        : "min-h-[48px] px-5 text-[15px] rounded-xl";
  return (
    <button
      className={`inline-flex cursor-pointer select-none items-center justify-center gap-2 transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 ${sizeClasses} ${VARIANT_CLASSES[variant]} ${className}`}
      disabled={disabled || loading}
      type={type}
      {...rest}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section label (uppercase eyebrow used across screens)
// ---------------------------------------------------------------------------

export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`font-display font-bold text-[12px] text-muted-foreground/80 uppercase tracking-[0.18em] ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function WCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card ${className}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pill badge
// ---------------------------------------------------------------------------

export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "blood" | "green" | "gold";
  className?: string;
}) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    blood: "bg-blood-dim text-blood",
    green:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    gold: "bg-amber-400/15 text-amber-600 dark:text-amber-300",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-[12px] leading-none ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
