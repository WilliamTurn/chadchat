"use client";

import { CheckIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { createCheckoutSession } from "@/app/pricing/actions";
import { toast } from "@/components/chat/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanTier } from "@/lib/subscription";

type Feature = { label: string; soon?: boolean };

type Plan = {
  tier: PlanTier;
  name: string;
  price: string;
  tagline: string;
  features: Feature[];
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    tier: "basic",
    name: "Chad Basic",
    price: "$29",
    tagline: "Your always-on coach.",
    features: [
      { label: "Chat with Chad anytime, day or night" },
      { label: "Personalized workout & nutrition guidance" },
      { label: "Form tips, motivation & real accountability" },
      { label: "Your full coaching history, always saved" },
    ],
  },
  {
    tier: "pro",
    name: "Chad Pro",
    price: "$39",
    tagline: "The complete Chad experience.",
    highlighted: true,
    features: [
      { label: "Everything in Basic" },
      { label: "Progress photo analysis — Chad reviews your form" },
      { label: "Custom workout & nutrition plans built for you", soon: true },
      { label: "Highest-priority access to Chad" },
    ],
  },
];

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
            "We couldn't start checkout just now. Please try again in a moment.",
        });
      }
    });
  }

  return (
    <div className="grid w-full max-w-3xl gap-5 sm:grid-cols-2">
      {PLANS.map((plan) => {
        const isCurrent = currentTier === plan.tier;
        const isLoading = isPending && loadingTier === plan.tier;

        return (
          <div
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm",
              plan.highlighted
                ? "border-primary/60 ring-1 ring-primary/30"
                : "border-border"
            )}
            key={plan.tier}
          >
            {plan.highlighted && (
              <Badge className="absolute -top-2.5 left-6">Most popular</Badge>
            )}

            <div className="mb-1 font-semibold text-lg">{plan.name}</div>
            <p className="mb-4 text-muted-foreground text-sm">{plan.tagline}</p>

            <div className="mb-5 flex items-baseline gap-1">
              <span className="font-semibold text-3xl tracking-tight">
                {plan.price}
              </span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>

            <ul className="mb-6 flex flex-col gap-3 text-sm">
              {plan.features.map((feature) => (
                <li className="flex items-start gap-2.5" key={feature.label}>
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
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
              className="mt-auto w-full"
              disabled={isPending || isCurrent}
              onClick={() => startCheckout(plan.tier)}
              size="lg"
              variant={plan.highlighted ? "default" : "outline"}
            >
              {isCurrent
                ? "Your current plan"
                : isLoading
                  ? alreadyTrialed
                    ? "Starting checkout…"
                    : "Starting your free trial…"
                  : alreadyTrialed
                    ? `Subscribe — ${plan.price}/mo`
                    : "Start 3-day free trial"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
