import { ChefHat, CircleCheck } from "lucide-react";
import Link from "next/link";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { SegmentStrip } from "@/components/charts/segment-strip";
import { PlanPanel } from "@/components/panels/roles";
import { Button } from "@/components/ui/button";
import { formatQuantity } from "@/lib/contracts/units";
import type { MealSliceToday } from "@/lib/plans/meal-slice";

/**
 * MEAL PLAN TODAY (FIX-30). The plans-band summary of the member's next
 * practical meal: the registered plans.mealSlice.today metric (deterministic
 * rotation day + plan-order meal progression), framed around the NEXT
 * decision the member makes (the MacroFactor forward-planning grammar from
 * the rule-8 teardown), never the whole plan document squeezed into a card.
 *
 * One destination: "Open meal plan" (the old card's View plan / Open plan
 * duplicate pair is exactly the FIX-30 target). Meal logging stays on its
 * owned page flows (s168); nothing here mutates.
 */

export function PlanMealToday({
  slice,
  planTitle,
  locked = false,
  className,
}: {
  /** null = no active meal plan (designed empty) OR an unreadable plan
   *  document (the honest open-the-plan fallback keyed by planTitle). */
  slice: MealSliceToday | null;
  /** The active plan's title; null = no active meal plan. */
  planTitle: string | null;
  /** Entitlement gate: renders the locked teaser (no member data needed). */
  locked?: boolean;
  className?: string;
}) {
  const covered = slice != null && slice.nextMeal == null;

  const slotStrip = slice ? (
    <div className="flex flex-col gap-1.5">
      <SegmentStrip
        accent="amber"
        label={`Planned meals on ${slice.dayLabel}`}
        segments={Array.from({ length: slice.mealsPlanned }, (_, i) => ({
          key: i,
          status:
            i < Math.min(slice.mealsLoggedToday, slice.mealsPlanned)
              ? "done"
              : slice.nextMeal && i === slice.nextMeal.position
                ? "next"
                : "upcoming",
          label:
            i < Math.min(slice.mealsLoggedToday, slice.mealsPlanned)
              ? `Meal ${i + 1} of ${slice.mealsPlanned}: covered by today's logs`
              : slice.nextMeal && i === slice.nextMeal.position
                ? `Meal ${i + 1} of ${slice.mealsPlanned}: up next`
                : `Meal ${i + 1} of ${slice.mealsPlanned}: later today`,
        }))}
      />
      <p className="text-meta text-muted-foreground">{slice.reason}</p>
    </div>
  ) : null;

  const mealChips = slice?.nextMeal ? (
    <div className="flex flex-wrap gap-2">
      <MealChip
        label="planned"
        value={formatQuantity(slice.nextMeal.calories, "kcal")}
      />
      <MealChip label="protein" value={`${slice.nextMeal.protein}g`} />
      <MealChip
        label={`${slice.dayLabel} total`}
        value={formatQuantity(slice.plannedDay.calories, "kcal")}
      />
    </div>
  ) : null;

  return (
    <PlanPanel
      className={className}
      detailLink={{ label: "Open meal plan", href: "/meal-plan" }}
      empty={{
        absent: "No meal plan yet.",
        unlock:
          "Chad builds a structured plan around your macro target. Real foods, exact portions.",
        action: (
          <Button
            asChild
            className="min-h-11 sm:min-h-8"
            size="sm"
            variant="outline"
          >
            <Link href="/meal-plan">Build a meal plan</Link>
          </Button>
        ),
      }}
      footer={{
        status: covered ? "Planned meals covered for today" : undefined,
        askChad: (
          <AskChadButton
            className="min-h-11 sm:min-h-8"
            prompt={
              slice?.nextMeal
                ? `My meal plan says my next meal is "${slice.nextMeal.title}". Walk me through it, and what can I swap if I'm missing something?`
                : planTitle
                  ? "Walk me through my meal plan. What am I eating today, and what can I swap if I'm missing something?"
                  : "Should I be on a structured meal plan for my goal? What would you put in one for me?"
            }
          />
        ),
      }}
      glow={covered ? "emerald" : "amber"}
      headline={
        !planTitle ? (
          "No meal plan"
        ) : covered ? (
          <span className="flex min-w-0 items-baseline gap-2 text-positive-text">
            <CircleCheck aria-hidden className="size-5 self-center" />
            Planned meals covered
          </span>
        ) : slice?.nextMeal ? (
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="min-w-0">{slice.nextMeal.title}</span>
            <span className="text-body-sm text-muted-foreground">
              next meal
            </span>
          </span>
        ) : (
          planTitle
        )
      }
      icon={<ChefHat className="size-4" />}
      lockedCapability="Pro members get a structured meal plan and see their next planned meal here."
      state={locked ? "locked" : planTitle ? "populated" : "empty"}
      title="Meal plan today"
      wrapTitle
      tone="amber"
      visual={
        !planTitle ? null : slice ? (
          <div className="flex min-w-0 flex-col gap-3">
            {slotStrip}
            {mealChips}
          </div>
        ) : (
          <p className="text-body-sm text-muted-foreground">
            {planTitle} is saved, but its days could not be read. Open the
            plan to see today's meals.
          </p>
        )
      }
    />
  );
}

function MealChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-xl border border-border bg-background/40 px-3 py-1.5">
      <span className="font-display font-semibold text-sm leading-none">
        {value}
      </span>
      <span className="text-meta text-muted-foreground">{label}</span>
    </div>
  );
}
