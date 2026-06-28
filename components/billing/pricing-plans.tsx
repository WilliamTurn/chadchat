"use client";

import { CheckIcon, Star } from "lucide-react";
import { useState, useTransition } from "react";
import { createCheckoutSession } from "@/app/pricing/actions";
import { toast } from "@/components/chat/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MARKETING_PLANS } from "@/lib/plans";
import type { PlanTier } from "@/lib/subscription";
import { cn } from "@/lib/utils";

export function PricingPlans({
  currentTier,
  alreadyTrialed = false,
}: {
  currentTier?: PlanTier | null;
  alreadyTrialed?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);

  function startCheckout(tier: PlanTier) {
    setLoadingTier(tier);
    startTransition(async () => {
      try {
        await createCheckoutSession(tier);
      } catch {
        // A successful checkout redirects away; reaching here means it failed.
        setLoadingTier(null);
        toast({
          type: "error",
          description:
            "Something went wrong starting checkout. Please try again in a moment.",
        });
      }
    });
  }

  return (
    <div className="grid w-full max-w-3xl gap-5 sm:grid-cols-2">
      {MARKETING_PLANS.map((plan) => {
        const isCurrent = currentTier === plan.tier;
        const isLoading = isPending && loadingTier === plan.tier;

        // One clear action per card. New customers start the free trial;
        // returning/cancelled customers (trial already spent) subscribe and are
        // charged today. The price + terms live in a single line under the
        // button so a card never reads as two competing offers.
        let cta: string;
        if (isCurrent) {
          cta = "Your current plan";
        } else if (isLoading) {
          cta = alreadyTrialed ? "Starting checkout…" : "Starting your trial…";
        } else if (alreadyTrialed) {
          cta = "Subscribe";
        } else {
          cta = "Start free trial";
        }

        const terms = alreadyTrialed
          ? `${plan.price}/month · Cancel anytime`
          : `3 days free, then ${plan.price}/month · Cancel anytime`;

        return (
          <div
            className={cn(
              "relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-float)]",
              plan.highlighted
                ? "border-blood/60 ring-1 ring-blood/30"
                : "border-border"
            )}
            key={plan.tier}
          >
            {/* Soft brand glow behind the recommended plan, clipped by the
                card's overflow-hidden so it reads as an inner aura. */}
            {plan.highlighted && (
              <div
                aria-hidden
                className="-right-12 -top-12 pointer-events-none absolute size-40 rounded-full bg-blood/15 blur-3xl"
              />
            )}

            {plan.highlighted && (
              <Badge className="absolute top-0 right-6 rounded-t-none border-transparent bg-blood text-white">
                Most popular
              </Badge>
            )}

            <div className="relative flex flex-1 flex-col">
              <div className="mb-1 font-semibold text-lg">{plan.name}</div>
              <p className="mb-4 text-muted-foreground text-sm">
                {plan.tagline}
              </p>

              <div className="mb-3 flex items-baseline gap-1">
                <span className="font-semibold text-3xl tracking-tight">
                  {plan.price}
                </span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>

              {/* Anchoring social proof on the recommended plan — ad-safe label,
                  no fabricated counts (matches the page TrustStrip wording). */}
              {plan.highlighted && (
                <div className="mb-5 flex items-center gap-1.5 text-muted-foreground text-xs">
                  <span className="flex items-center gap-0.5 text-amber-500">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star className="size-3 fill-current" key={i} />
                    ))}
                  </span>
                  Loved by lifters
                </div>
              )}

              <ul className="mb-6 flex flex-col gap-3 text-sm">
                {plan.features.map((feature) => (
                  <li className="flex items-start gap-2.5" key={feature.label}>
                    <CheckIcon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        plan.highlighted ? "text-blood" : "text-primary"
                      )}
                    />
                    <span>
                      {feature.label}
                      {feature.soon && (
                        <span className="ml-1.5 text-muted-foreground text-xs">
                          (coming soon)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                className={cn(
                  "mt-auto w-full",
                  plan.highlighted && "bg-blood text-white hover:bg-blood/90"
                )}
                disabled={isPending || isCurrent}
                onClick={() => startCheckout(plan.tier)}
                size="lg"
                variant={plan.highlighted ? "default" : "outline"}
              >
                {cta}
              </Button>

              {!isCurrent && (
                <p className="mt-3 text-center text-muted-foreground text-xs">
                  {terms}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
