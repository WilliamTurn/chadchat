"use client";

import { Check, Clock, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared branded status block for the auth recovery screens (ACC-6).
 *
 * Replaces the old flat "headline + paragraph + underline link" success/expired
 * states on forgot-password / reset-password / verify-email with a real status
 * icon (a check that springs in on success, a muted clock for pending/expired)
 * and a proper Button for the recovery action — so a finished flow reads as
 * resolved instead of unstyled text.
 *
 * Renders as a fragment so it drops straight into the auth card's existing
 * `flex flex-col gap-2` slot. Safe to render from a Server Component: it takes
 * only serializable props (the `icon` override is for client callers only — the
 * server pages rely on the per-variant default icon).
 */
type AuthStatusVariant = "success" | "pending" | "expired";

export function AuthStatus({
  variant,
  title,
  description,
  icon,
  action,
}: {
  variant: AuthStatusVariant;
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: { href: string; label: string };
}) {
  const isSuccess = variant === "success";
  const Icon = icon ?? (isSuccess ? Check : Clock);

  return (
    <>
      <motion.span
        animate={{ scale: 1, opacity: 1 }}
        aria-hidden
        className={cn(
          "mb-1 flex size-12 items-center justify-center rounded-full ring-1",
          isSuccess
            ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20"
            : "bg-muted text-muted-foreground ring-border/60"
        )}
        initial={{ scale: 0.6, opacity: 0 }}
        transition={
          isSuccess
            ? { type: "spring", stiffness: 400, damping: 16 }
            : { duration: 0.25 }
        }
      >
        <Icon className="size-6" strokeWidth={isSuccess ? 3 : 2} />
      </motion.span>
      <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>
      {action && (
        <Link
          className={buttonVariants({ className: "mt-2 w-fit" })}
          href={action.href}
        >
          {action.label}
        </Link>
      )}
    </>
  );
}
